import { db } from "@/lib/db";
import { Prisma, TipoMovimento, type Movimentacao } from "@/generated/prisma/client";

export class SaldoInsuficienteError extends Error {
  produtoId: string;
  disponivel: Prisma.Decimal;
  solicitado: Prisma.Decimal;

  constructor(produtoId: string, disponivel: Prisma.Decimal, solicitado: Prisma.Decimal) {
    super(
      `Saldo insuficiente: disponível ${disponivel.toString()}, solicitado ${solicitado.toString()}.`
    );
    this.name = "SaldoInsuficienteError";
    this.produtoId = produtoId;
    this.disponivel = disponivel;
    this.solicitado = solicitado;
  }
}

/**
 * Monta uma mensagem de erro amigável identificando o produto sem saldo —
 * útil em lançamentos com vários itens, onde não fica óbvio qual item falhou.
 */
export async function mensagemSaldoInsuficiente(error: SaldoInsuficienteError): Promise<string> {
  const produto = await db.produto.findUnique({
    where: { id: error.produtoId },
    select: { nome: true, sku: true },
  });
  const identificacao = produto ? `"${produto.nome} — ${produto.sku}"` : "produto";
  return `Saldo insuficiente para ${identificacao}: disponível ${error.disponivel.toString()}, solicitado ${error.solicitado.toString()}.`;
}

type TipoMovimentoEntrada = Extract<
  TipoMovimento,
  "compra" | "devolucao_cliente" | "ajuste_entrada"
>;

type TipoMovimentoSaida = Extract<
  TipoMovimento,
  "venda" | "devolucao_fornecedor" | "perda_avaria" | "uso_interno" | "ajuste_saida" | "os_saida"
>;

type EstoqueTravado = {
  id: string;
  quantidadeSaldo: Prisma.Decimal;
  custoMedioAtual: Prisma.Decimal;
  valorTotalSaldo: Prisma.Decimal;
};

/**
 * Garante que existe uma linha de produto_estoque para o par produto+depósito
 * e trava a linha (FOR UPDATE) para a transação corrente, evitando race
 * conditions quando dois usuários lançam movimentos do mesmo item ao mesmo tempo.
 * O INSERT ... ON CONFLICT DO UPDATE é atômico: cria a linha se não existir,
 * ou trava a existente — sem janela entre "checar" e "criar".
 */
async function obterOuCriarEstoqueTravado(
  tx: Prisma.TransactionClient,
  produtoId: string,
  depositoId: string
): Promise<EstoqueTravado> {
  const rows = await tx.$queryRaw<
    { id: string; quantidade_saldo: string; custo_medio_atual: string; valor_total_saldo: string }[]
  >`
    INSERT INTO produto_estoque (id, produto_id, deposito_id, quantidade_saldo, custo_medio_atual, valor_total_saldo, atualizado_em)
    VALUES (gen_random_uuid(), ${produtoId}::uuid, ${depositoId}::uuid, 0, 0, 0, now())
    ON CONFLICT (produto_id, deposito_id)
    DO UPDATE SET atualizado_em = produto_estoque.atualizado_em
    RETURNING id, quantidade_saldo, custo_medio_atual, valor_total_saldo
  `;

  const row = rows[0];
  return {
    id: row.id,
    quantidadeSaldo: new Prisma.Decimal(row.quantidade_saldo),
    custoMedioAtual: new Prisma.Decimal(row.custo_medio_atual),
    valorTotalSaldo: new Prisma.Decimal(row.valor_total_saldo),
  };
}

function paraDecimal(valor: number | string | Prisma.Decimal): Prisma.Decimal {
  return valor instanceof Prisma.Decimal ? valor : new Prisma.Decimal(valor);
}

export type RegistrarEntradaInput = {
  produtoId: string;
  depositoId: string;
  tipoMovimento: TipoMovimentoEntrada;
  quantidade: number | string;
  custoUnitario: number | string;
  fornecedorId?: string;
  usuarioId: string;
  observacao?: string;
  dataMovimento?: Date;
};

/**
 * Mesma lógica de `registrarEntrada`, mas recebendo a transação de fora —
 * permite agrupar várias entradas (ex.: uma Nova Movimentação com vários
 * produtos) na mesma transação atômica, tudo-ou-nada.
 */
export async function registrarEntradaNaTransacao(
  tx: Prisma.TransactionClient,
  input: RegistrarEntradaInput
): Promise<Movimentacao> {
  const quantidadeEntrada = paraDecimal(input.quantidade);
  const custoUnitarioEntrada = paraDecimal(input.custoUnitario);

  if (quantidadeEntrada.lessThanOrEqualTo(0)) {
    throw new Error("Quantidade da entrada deve ser maior que zero.");
  }
  if (custoUnitarioEntrada.lessThan(0)) {
    throw new Error("Custo unitário não pode ser negativo.");
  }

  const estoque = await obterOuCriarEstoqueTravado(tx, input.produtoId, input.depositoId);

  const novaQuantidade = estoque.quantidadeSaldo.plus(quantidadeEntrada);
  const novoValorTotal = estoque.quantidadeSaldo
    .times(estoque.custoMedioAtual)
    .plus(quantidadeEntrada.times(custoUnitarioEntrada));
  const novoCustoMedio = novaQuantidade.isZero()
    ? new Prisma.Decimal(0)
    : novoValorTotal.dividedBy(novaQuantidade);

  await tx.produtoEstoque.update({
    where: { id: estoque.id },
    data: {
      quantidadeSaldo: novaQuantidade,
      custoMedioAtual: novoCustoMedio,
      valorTotalSaldo: novoValorTotal,
    },
  });

  return tx.movimentacao.create({
    data: {
      produtoId: input.produtoId,
      depositoId: input.depositoId,
      tipoMovimento: input.tipoMovimento,
      dataMovimento: input.dataMovimento ?? new Date(),
      quantidade: quantidadeEntrada,
      custoUnitario: custoUnitarioEntrada,
      custoMedioApos: novoCustoMedio,
      saldoQuantidadeApos: novaQuantidade,
      saldoValorApos: novoValorTotal,
      fornecedorId: input.fornecedorId,
      usuarioId: input.usuarioId,
      observacao: input.observacao,
    },
  });
}

/**
 * Registra uma entrada de estoque e recalcula o custo médio ponderado móvel:
 * novoCustoMedio = (saldoAtualValor + valorEntrada) / (saldoAtualQtd + qtdEntrada)
 */
export async function registrarEntrada(input: RegistrarEntradaInput): Promise<Movimentacao> {
  return db.$transaction((tx) => registrarEntradaNaTransacao(tx, input));
}

export type RegistrarSaidaInput = {
  produtoId: string;
  depositoId: string;
  tipoMovimento: TipoMovimentoSaida;
  quantidade: number | string;
  precoVenda?: number | string;
  clienteId?: string;
  usuarioId: string;
  observacao?: string;
  dataMovimento?: Date;
  ordemServicoId?: string;
};

/**
 * Mesma lógica de `registrarSaida`, mas recebendo a transação de fora —
 * permite que quem chama (ex.: conclusão de uma Ordem de Serviço com vários
 * itens) agrupe múltiplas saídas na mesma transação atômica, tudo-ou-nada.
 */
export async function registrarSaidaNaTransacao(
  tx: Prisma.TransactionClient,
  input: RegistrarSaidaInput
): Promise<Movimentacao> {
  const quantidadeSaida = paraDecimal(input.quantidade);

  if (quantidadeSaida.lessThanOrEqualTo(0)) {
    throw new Error("Quantidade da saída deve ser maior que zero.");
  }

  const estoque = await obterOuCriarEstoqueTravado(tx, input.produtoId, input.depositoId);

  if (quantidadeSaida.greaterThan(estoque.quantidadeSaldo)) {
    throw new SaldoInsuficienteError(input.produtoId, estoque.quantidadeSaldo, quantidadeSaida);
  }

  const novaQuantidade = estoque.quantidadeSaldo.minus(quantidadeSaida);
  const novoValorTotal = novaQuantidade.times(estoque.custoMedioAtual);

  await tx.produtoEstoque.update({
    where: { id: estoque.id },
    data: {
      quantidadeSaldo: novaQuantidade,
      valorTotalSaldo: novoValorTotal,
    },
  });

  return tx.movimentacao.create({
    data: {
      produtoId: input.produtoId,
      depositoId: input.depositoId,
      tipoMovimento: input.tipoMovimento,
      dataMovimento: input.dataMovimento ?? new Date(),
      quantidade: quantidadeSaida,
      custoMedioApos: estoque.custoMedioAtual,
      saldoQuantidadeApos: novaQuantidade,
      saldoValorApos: novoValorTotal,
      precoVenda:
        input.precoVenda !== undefined ? paraDecimal(input.precoVenda) : undefined,
      clienteId: input.clienteId,
      usuarioId: input.usuarioId,
      observacao: input.observacao,
      ordemServicoId: input.ordemServicoId,
    },
  });
}

/**
 * Registra uma saída de estoque. O custo médio NÃO muda em saídas — a baixa
 * sempre ocorre pelo custo médio vigente no momento do lançamento.
 * Bloqueia se a quantidade solicitada for maior que o saldo disponível.
 */
export async function registrarSaida(input: RegistrarSaidaInput): Promise<Movimentacao> {
  return db.$transaction((tx) => registrarSaidaNaTransacao(tx, input));
}

export type RegistrarTransferenciaInput = {
  produtoId: string;
  depositoOrigemId: string;
  depositoDestinoId: string;
  quantidade: number | string;
  usuarioId: string;
  observacao?: string;
};

/**
 * Mesma lógica de `registrarTransferencia`, mas recebendo a transação de
 * fora — permite agrupar várias transferências (ex.: uma Nova Movimentação
 * com vários produtos) na mesma transação atômica, tudo-ou-nada.
 */
export async function registrarTransferenciaNaTransacao(
  tx: Prisma.TransactionClient,
  input: RegistrarTransferenciaInput
): Promise<{ saida: Movimentacao; entrada: Movimentacao }> {
  const quantidade = paraDecimal(input.quantidade);

  if (quantidade.lessThanOrEqualTo(0)) {
    throw new Error("Quantidade da transferência deve ser maior que zero.");
  }
  if (input.depositoOrigemId === input.depositoDestinoId) {
    throw new Error("Depósito de origem e destino devem ser diferentes.");
  }

  const depositosEmOrdem = [input.depositoOrigemId, input.depositoDestinoId].sort();
  const travados = new Map<string, EstoqueTravado>();
  for (const depositoId of depositosEmOrdem) {
    travados.set(depositoId, await obterOuCriarEstoqueTravado(tx, input.produtoId, depositoId));
  }

  const estoqueOrigem = travados.get(input.depositoOrigemId)!;
  const estoqueDestino = travados.get(input.depositoDestinoId)!;

  if (quantidade.greaterThan(estoqueOrigem.quantidadeSaldo)) {
    throw new SaldoInsuficienteError(input.produtoId, estoqueOrigem.quantidadeSaldo, quantidade);
  }

  const custoMedioOrigem = estoqueOrigem.custoMedioAtual;
  const novaQuantidadeOrigem = estoqueOrigem.quantidadeSaldo.minus(quantidade);
  const novoValorOrigem = novaQuantidadeOrigem.times(custoMedioOrigem);

  await tx.produtoEstoque.update({
    where: { id: estoqueOrigem.id },
    data: { quantidadeSaldo: novaQuantidadeOrigem, valorTotalSaldo: novoValorOrigem },
  });

  const saida = await tx.movimentacao.create({
    data: {
      produtoId: input.produtoId,
      depositoId: input.depositoOrigemId,
      tipoMovimento: TipoMovimento.transferencia_saida,
      quantidade,
      custoMedioApos: custoMedioOrigem,
      saldoQuantidadeApos: novaQuantidadeOrigem,
      saldoValorApos: novoValorOrigem,
      usuarioId: input.usuarioId,
      observacao: input.observacao,
    },
  });

  const novaQuantidadeDestino = estoqueDestino.quantidadeSaldo.plus(quantidade);
  const novoValorTotalDestino = estoqueDestino.quantidadeSaldo
    .times(estoqueDestino.custoMedioAtual)
    .plus(quantidade.times(custoMedioOrigem));
  const novoCustoMedioDestino = novaQuantidadeDestino.isZero()
    ? new Prisma.Decimal(0)
    : novoValorTotalDestino.dividedBy(novaQuantidadeDestino);

  await tx.produtoEstoque.update({
    where: { id: estoqueDestino.id },
    data: {
      quantidadeSaldo: novaQuantidadeDestino,
      custoMedioAtual: novoCustoMedioDestino,
      valorTotalSaldo: novoValorTotalDestino,
    },
  });

  const entrada = await tx.movimentacao.create({
    data: {
      produtoId: input.produtoId,
      depositoId: input.depositoDestinoId,
      tipoMovimento: TipoMovimento.transferencia_entrada,
      quantidade,
      custoUnitario: custoMedioOrigem,
      custoMedioApos: novoCustoMedioDestino,
      saldoQuantidadeApos: novaQuantidadeDestino,
      saldoValorApos: novoValorTotalDestino,
      usuarioId: input.usuarioId,
      observacao: input.observacao,
    },
  });

  return { saida, entrada };
}

/**
 * Transferência entre depósitos: gera dois lançamentos na mesma transação
 * (saída na origem + entrada no destino), preservando o custo médio de origem.
 * As duas linhas de produto_estoque envolvidas são travadas em ordem
 * determinística (por depositoId) para evitar deadlock quando duas
 * transferências em sentidos opostos acontecem ao mesmo tempo.
 */
export async function registrarTransferencia(
  input: RegistrarTransferenciaInput
): Promise<{ saida: Movimentacao; entrada: Movimentacao }> {
  return db.$transaction((tx) => registrarTransferenciaNaTransacao(tx, input));
}
