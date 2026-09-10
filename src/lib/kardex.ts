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

/**
 * Produtos com `controlaEstoque = false` podem ser indicados em movimentos e
 * OS (para histórico/faturamento), mas nunca alteram produto_estoque: o saldo
 * e o custo médio desses itens permanecem sempre zero, sem linha em
 * produto_estoque e sem bloqueio por saldo insuficiente.
 */
async function produtoControlaEstoque(tx: Prisma.TransactionClient, produtoId: string): Promise<boolean> {
  const produto = await tx.produto.findUniqueOrThrow({
    where: { id: produtoId },
    select: { controlaEstoque: true },
  });
  return produto.controlaEstoque;
}

export type RegistrarEntradaInput = {
  produtoId: string;
  depositoId: string;
  tipoMovimento: TipoMovimentoEntrada;
  quantidade: number | string | Prisma.Decimal;
  custoUnitario: number | string | Prisma.Decimal;
  fornecedorId?: string;
  usuarioId: string;
  observacao?: string;
  dataMovimento?: Date;
  orcamentoId?: string;
  lancamentoId?: string;
};

/**
 * Mesma lógica de `registrarEntrada`, mas recebendo a transação de fora —
 * permite agrupar várias entradas (ex.: um Lançamento com vários
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

  if (!(await produtoControlaEstoque(tx, input.produtoId))) {
    const zero = new Prisma.Decimal(0);
    return tx.movimentacao.create({
      data: {
        produtoId: input.produtoId,
        depositoId: input.depositoId,
        tipoMovimento: input.tipoMovimento,
        dataMovimento: input.dataMovimento ?? new Date(),
        quantidade: quantidadeEntrada,
        custoUnitario: custoUnitarioEntrada,
        custoMedioApos: zero,
        saldoQuantidadeApos: zero,
        saldoValorApos: zero,
        fornecedorId: input.fornecedorId,
        usuarioId: input.usuarioId,
        observacao: input.observacao,
        orcamentoId: input.orcamentoId,
        lancamentoId: input.lancamentoId,
      },
    });
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
      orcamentoId: input.orcamentoId,
      lancamentoId: input.lancamentoId,
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
  vendedorId?: string;
  usuarioId: string;
  observacao?: string;
  dataMovimento?: Date;
  ordemServicoId?: string;
  lancamentoId?: string;
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

  if (!(await produtoControlaEstoque(tx, input.produtoId))) {
    const zero = new Prisma.Decimal(0);
    return tx.movimentacao.create({
      data: {
        produtoId: input.produtoId,
        depositoId: input.depositoId,
        tipoMovimento: input.tipoMovimento,
        dataMovimento: input.dataMovimento ?? new Date(),
        quantidade: quantidadeSaida,
        custoMedioApos: zero,
        saldoQuantidadeApos: zero,
        saldoValorApos: zero,
        precoVenda: input.precoVenda !== undefined ? paraDecimal(input.precoVenda) : undefined,
        clienteId: input.clienteId,
        vendedorId: input.vendedorId,
        usuarioId: input.usuarioId,
        observacao: input.observacao,
        ordemServicoId: input.ordemServicoId,
        lancamentoId: input.lancamentoId,
      },
    });
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
      vendedorId: input.vendedorId,
      usuarioId: input.usuarioId,
      observacao: input.observacao,
      ordemServicoId: input.ordemServicoId,
      lancamentoId: input.lancamentoId,
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
  lancamentoId?: string;
};

/**
 * Mesma lógica de `registrarTransferencia`, mas recebendo a transação de
 * fora — permite agrupar várias transferências (ex.: um Lançamento
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

  if (!(await produtoControlaEstoque(tx, input.produtoId))) {
    const zero = new Prisma.Decimal(0);
    const saida = await tx.movimentacao.create({
      data: {
        produtoId: input.produtoId,
        depositoId: input.depositoOrigemId,
        tipoMovimento: TipoMovimento.transferencia_saida,
        quantidade,
        custoMedioApos: zero,
        saldoQuantidadeApos: zero,
        saldoValorApos: zero,
        usuarioId: input.usuarioId,
        observacao: input.observacao,
        lancamentoId: input.lancamentoId,
      },
    });
    const entrada = await tx.movimentacao.create({
      data: {
        produtoId: input.produtoId,
        depositoId: input.depositoDestinoId,
        tipoMovimento: TipoMovimento.transferencia_entrada,
        quantidade,
        custoMedioApos: zero,
        saldoQuantidadeApos: zero,
        saldoValorApos: zero,
        usuarioId: input.usuarioId,
        observacao: input.observacao,
        lancamentoId: input.lancamentoId,
      },
    });
    return { saida, entrada };
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
      lancamentoId: input.lancamentoId,
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
      lancamentoId: input.lancamentoId,
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

export type EstornarEntradaInput = {
  produtoId: string;
  depositoId: string;
  quantidade: number | string | Prisma.Decimal;
  custoUnitarioOriginal: number | string | Prisma.Decimal;
  usuarioId: string;
  observacao?: string;
  orcamentoId?: string;
};

/**
 * Estorna uma entrada específica — hoje usado apenas ao cancelar o
 * fechamento de um Orçamento de Compra (ver src/app/(app)/orcamentos).
 * É uma EXCEÇÃO deliberada ao invariante "saídas nunca mudam custoMedioAtual":
 * uma saída comum debita ao custo médio VIGENTE, mas aqui o objetivo é desfazer
 * exatamente o efeito daquela entrada sobre a média ponderada — subtraímos a
 * quantidade e o valor exatos que ela havia somado (quantidade *
 * custoUnitarioOriginal) e recalculamos a média a partir do que sobra. Isso
 * preserva corretamente o efeito de quaisquer outras movimentações feitas
 * depois da entrada original (diferente de simplesmente dar baixa ao custo
 * médio atual, que não reverteria a média ao que era antes da compra).
 * Lançado como `devolucao_fornecedor` (tipo de saída) no Kardex.
 */
export async function estornarEntradaNaTransacao(
  tx: Prisma.TransactionClient,
  input: EstornarEntradaInput
): Promise<Movimentacao> {
  const quantidade = paraDecimal(input.quantidade);
  const custoUnitarioOriginal = paraDecimal(input.custoUnitarioOriginal);

  if (quantidade.lessThanOrEqualTo(0)) {
    throw new Error("Quantidade do estorno deve ser maior que zero.");
  }

  if (!(await produtoControlaEstoque(tx, input.produtoId))) {
    const zero = new Prisma.Decimal(0);
    return tx.movimentacao.create({
      data: {
        produtoId: input.produtoId,
        depositoId: input.depositoId,
        tipoMovimento: TipoMovimento.devolucao_fornecedor,
        quantidade,
        custoUnitario: custoUnitarioOriginal,
        custoMedioApos: zero,
        saldoQuantidadeApos: zero,
        saldoValorApos: zero,
        usuarioId: input.usuarioId,
        observacao: input.observacao,
        orcamentoId: input.orcamentoId,
      },
    });
  }

  const estoque = await obterOuCriarEstoqueTravado(tx, input.produtoId, input.depositoId);

  if (quantidade.greaterThan(estoque.quantidadeSaldo)) {
    throw new SaldoInsuficienteError(input.produtoId, estoque.quantidadeSaldo, quantidade);
  }

  const novaQuantidade = estoque.quantidadeSaldo.minus(quantidade);
  const valorAEstornar = quantidade.times(custoUnitarioOriginal);
  const novoValorTotalBruto = estoque.valorTotalSaldo.minus(valorAEstornar);
  // Guarda contra deriva: outras movimentações do produto podem ter alterado
  // a média entre a entrada original e este estorno; nunca deixamos o valor
  // total do saldo ficar negativo por causa disso.
  const novoValorTotal = novoValorTotalBruto.lessThan(0) ? new Prisma.Decimal(0) : novoValorTotalBruto;
  const novoCustoMedio = novaQuantidade.isZero() ? new Prisma.Decimal(0) : novoValorTotal.dividedBy(novaQuantidade);

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
      tipoMovimento: TipoMovimento.devolucao_fornecedor,
      quantidade,
      custoUnitario: custoUnitarioOriginal,
      custoMedioApos: novoCustoMedio,
      saldoQuantidadeApos: novaQuantidade,
      saldoValorApos: novoValorTotal,
      usuarioId: input.usuarioId,
      observacao: input.observacao,
      orcamentoId: input.orcamentoId,
    },
  });
}

export class MovimentoJaEstornadoError extends Error {
  constructor() {
    super("Este movimento já foi estornado.");
    this.name = "MovimentoJaEstornadoError";
  }
}

const TIPOS_ENTRADA_ESTORNAVEL = new Set<TipoMovimento>(["compra", "devolucao_cliente", "ajuste_entrada"]);
const TIPOS_SAIDA_ESTORNAVEL = new Set<TipoMovimento>([
  "venda",
  "devolucao_fornecedor",
  "perda_avaria",
  "uso_interno",
  "ajuste_saida",
]);

export type EstornarMovimentoInput = {
  movimentoId: string;
  usuarioId: string;
  observacao?: string;
};

/**
 * Núcleo do estorno de UMA linha de movimento — usado tanto pelo estorno
 * avulso (`estornarMovimentoNaTransacao`, movimentos sem dono) quanto pelo
 * `cancelarFechamentoLancamento` (src/app/(app)/lancamentos/actions.ts), que
 * chama isto diretamente por já ser o "dono" legítimo do movimento.
 * Gera um lançamento inverso EXATO (não um novo lançamento genérico ao custo
 * médio vigente) e marca o original como estornado, impedindo estorno
 * duplicado:
 *
 * Entrada → estornada como uma saída (`ajuste_saida`) que subtrai a
 * quantidade/valor exatos que a entrada somou, igual a `estornarEntradaNaTransacao`.
 * Saída → estornada como uma entrada (`ajuste_entrada`) que devolve a
 * quantidade ao custo médio vigente NO MOMENTO daquela saída
 * (`custoMedioApos` do original, que saídas nunca alteram) — o inverso exato
 * da operação, simétrico ao caso de entrada.
 */
export async function estornarLinhaDeMovimentoNaTransacao(
  tx: Prisma.TransactionClient,
  original: Movimentacao,
  usuarioId: string,
  observacao?: string
): Promise<Movimentacao> {
  if (original.estornadoEm || original.estornoDeId) {
    throw new MovimentoJaEstornadoError();
  }

  const ehEntrada = TIPOS_ENTRADA_ESTORNAVEL.has(original.tipoMovimento);
  const ehSaida = TIPOS_SAIDA_ESTORNAVEL.has(original.tipoMovimento);
  if (!ehEntrada && !ehSaida) {
    throw new Error("Esse tipo de movimento não pode ser estornado por aqui.");
  }

  const quantidade = original.quantidade;
  const tipoEstorno = ehEntrada ? TipoMovimento.ajuste_saida : TipoMovimento.ajuste_entrada;
  // Custo ao qual o estorno deve mexer no saldo: o custo unitário da entrada
  // original (se for entrada) ou o custo médio vigente na saída original
  // (se for saída — saídas nunca alteram a média, então é o mesmo custo
  // médio de antes e de depois daquela saída).
  const custoDoEstorno = ehEntrada ? (original.custoUnitario ?? new Prisma.Decimal(0)) : original.custoMedioApos;

  let estorno: Movimentacao;

  if (!(await produtoControlaEstoque(tx, original.produtoId))) {
    const zero = new Prisma.Decimal(0);
    estorno = await tx.movimentacao.create({
      data: {
        produtoId: original.produtoId,
        depositoId: original.depositoId,
        tipoMovimento: tipoEstorno,
        quantidade,
        custoUnitario: ehEntrada ? custoDoEstorno : undefined,
        custoMedioApos: zero,
        saldoQuantidadeApos: zero,
        saldoValorApos: zero,
        usuarioId,
        observacao,
        estornoDeId: original.id,
      },
    });
  } else {
    const estoque = await obterOuCriarEstoqueTravado(tx, original.produtoId, original.depositoId);

    if (ehEntrada) {
      if (quantidade.greaterThan(estoque.quantidadeSaldo)) {
        throw new SaldoInsuficienteError(original.produtoId, estoque.quantidadeSaldo, quantidade);
      }
      const novaQuantidade = estoque.quantidadeSaldo.minus(quantidade);
      const novoValorTotalBruto = estoque.valorTotalSaldo.minus(quantidade.times(custoDoEstorno));
      // Guarda contra deriva: outras movimentações podem ter alterado a média
      // entre o lançamento original e este estorno; nunca deixamos o valor
      // total do saldo ficar negativo por causa disso.
      const novoValorTotal = novoValorTotalBruto.lessThan(0) ? new Prisma.Decimal(0) : novoValorTotalBruto;
      const novoCustoMedio = novaQuantidade.isZero() ? new Prisma.Decimal(0) : novoValorTotal.dividedBy(novaQuantidade);

      await tx.produtoEstoque.update({
        where: { id: estoque.id },
        data: { quantidadeSaldo: novaQuantidade, custoMedioAtual: novoCustoMedio, valorTotalSaldo: novoValorTotal },
      });

      estorno = await tx.movimentacao.create({
        data: {
          produtoId: original.produtoId,
          depositoId: original.depositoId,
          tipoMovimento: tipoEstorno,
          quantidade,
          custoUnitario: custoDoEstorno,
          custoMedioApos: novoCustoMedio,
          saldoQuantidadeApos: novaQuantidade,
          saldoValorApos: novoValorTotal,
          usuarioId,
          observacao,
          estornoDeId: original.id,
        },
      });
    } else {
      const novaQuantidade = estoque.quantidadeSaldo.plus(quantidade);
      const novoValorTotal = estoque.valorTotalSaldo.plus(quantidade.times(custoDoEstorno));
      const novoCustoMedio = novaQuantidade.isZero() ? new Prisma.Decimal(0) : novoValorTotal.dividedBy(novaQuantidade);

      await tx.produtoEstoque.update({
        where: { id: estoque.id },
        data: { quantidadeSaldo: novaQuantidade, custoMedioAtual: novoCustoMedio, valorTotalSaldo: novoValorTotal },
      });

      estorno = await tx.movimentacao.create({
        data: {
          produtoId: original.produtoId,
          depositoId: original.depositoId,
          tipoMovimento: tipoEstorno,
          quantidade,
          custoMedioApos: novoCustoMedio,
          saldoQuantidadeApos: novaQuantidade,
          saldoValorApos: novoValorTotal,
          usuarioId,
          observacao,
          estornoDeId: original.id,
        },
      });
    }
  }

  await tx.movimentacao.update({ where: { id: original.id }, data: { estornadoEm: new Date() } });

  return estorno;
}

/**
 * Estorna um movimento avulso (sem dono) para corrigir erro de lançamento —
 * usado pelo botão "Estornar" da Ficha Kardex, hoje relevante só pra
 * movimentos legados de antes do Lançamento existir como entidade. Movimentos
 * de Ordem de Serviço, Orçamento de Compra ou Lançamento têm fluxo de estorno
 * próprio (cancelar a OS / cancelar o fechamento do orçamento ou lançamento)
 * e são rejeitados aqui — ver `estornarLinhaDeMovimentoNaTransacao` para o
 * núcleo do estorno, reaproveitado por quem já é o dono legítimo do movimento.
 */
export async function estornarMovimentoNaTransacao(
  tx: Prisma.TransactionClient,
  input: EstornarMovimentoInput
): Promise<Movimentacao> {
  const original = await tx.movimentacao.findUniqueOrThrow({ where: { id: input.movimentoId } });

  if (original.ordemServicoId || original.orcamentoId || original.lancamentoId) {
    throw new Error(
      "Movimentos de Ordem de Serviço, Orçamento de Compra ou Lançamento devem ser estornados por lá."
    );
  }

  return estornarLinhaDeMovimentoNaTransacao(tx, original, input.usuarioId, input.observacao);
}
