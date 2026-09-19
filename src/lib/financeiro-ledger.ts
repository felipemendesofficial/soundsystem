import { db } from "@/lib/db";
import {
  Prisma,
  type Baixa,
  type Estorno,
  type FechamentoDiario,
  type MovimentacaoFinanceira,
  type TransferenciaEntreContas,
  type TipoMovimentoTransferencia,
  type MovimentoAplicacao,
  type TipoMovimentoAplicacao,
} from "@/generated/prisma/client";
import { REGRAS_TRANSFERENCIA, erroContaOrigemTransferencia, erroContaDestinoTransferencia } from "@/lib/regras-conta-transferencia";
import { erroContaComumParaAplicacao } from "@/lib/regras-conta-aplicacao";

/**
 * Início do dia (00:00) na mesma data-calendário de `data`, ignorando hora —
 * `FechamentoDiario.data` e as comparações de janela de lançamento trabalham
 * só em granularidade de dia.
 */
function inicioDoDia(data: Date): Date {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

/** Fechamento diário mais recente ainda ativo (não reaberto) de uma empresa, ou `null` se nenhum existir ainda. */
export async function obterUltimoFechamentoAtivo(
  tx: Prisma.TransactionClient | typeof db,
  empresaId: string
): Promise<FechamentoDiario | null> {
  return tx.fechamentoDiario.findFirst({
    where: { empresaId, ativo: true },
    orderBy: { data: "desc" },
  });
}

/**
 * Lançamentos financeiros só podem ocorrer entre `(último fechamento, hoje]`
 * — nunca no futuro, nunca num dia já fechado. Sem tela de Fechamento Diário
 * ainda (leva futura), `ultimoFechamento` é sempre `null` pra empresa nova,
 * então a regra vira, na prática, só "não pode ser no futuro".
 */
export function validarDataDeMovimento(data: Date, ultimoFechamento: FechamentoDiario | null) {
  const dia = inicioDoDia(data);
  const hoje = inicioDoDia(new Date());

  if (dia.getTime() > hoje.getTime()) {
    throw new Error("A data não pode ser no futuro.");
  }
  if (ultimoFechamento && dia.getTime() <= inicioDoDia(ultimoFechamento.data).getTime()) {
    throw new Error("A data já está dentro de um período fechado.");
  }
}

export type RegistrarBaixaInput = {
  lancamentoId: string;
  contaId: string;
  dataBaixa: Date;
  juros: Prisma.Decimal;
  multa: Prisma.Decimal;
  desconto: Prisma.Decimal;
  historicoComplementar?: string;
  usuarioId?: string;
  /** Terceiro do adiantamento consumido — nunca os dois juntos; exigido em Server Action conforme a flag de `conta`. */
  adiantamentoClienteId?: string;
  adiantamentoFornecedorId?: string;
};

/**
 * Mesma lógica de `registrarBaixa`, mas recebendo a transação de fora —
 * espelha o par bare/`NaTransacao` de `src/lib/kardex.ts`, hoje sem uso real
 * de "várias baixas na mesma transação" mas mantido pelo mesmo motivo: dar a
 * quem chamar a opção de agrupar isso com outras operações no futuro (ex.:
 * baixa em lote).
 */
export async function registrarBaixaNaTransacao(
  tx: Prisma.TransactionClient,
  input: RegistrarBaixaInput
): Promise<{ baixa: Baixa; movimentacao: MovimentacaoFinanceira }> {
  const lancamento = await tx.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: input.lancamentoId } });
  if (lancamento.status !== "aberto") {
    throw new Error("Esse lançamento não está aberto para baixa.");
  }

  const ultimoFechamento = await obterUltimoFechamentoAtivo(tx, lancamento.empresaId);
  validarDataDeMovimento(input.dataBaixa, ultimoFechamento);

  // Retenção é imposto retido na fonte: some ao rateio do lançamento, mas
  // nunca chega a transitar pela conta financeira — só o valor líquido é
  // efetivamente pago/recebido. O que foi retido fica registrado em
  // `Retencao` (status `pendente`) até um futuro fluxo de "recolhimento".
  const retencoes = await tx.retencao.findMany({ where: { lancamentoId: input.lancamentoId } });
  const totalRetencoes = retencoes.reduce((acc, r) => acc.plus(r.valor), new Prisma.Decimal(0));

  const valorBaixado = lancamento.valorOriginal
    .minus(totalRetencoes)
    .plus(input.juros)
    .plus(input.multa)
    .minus(input.desconto);
  if (valorBaixado.lessThan(0)) {
    throw new Error("Retenções + desconto não pode ultrapassar o valor original mais juros e multa.");
  }

  // Trava a conta pra evitar duas baixas concorrentes lerem o mesmo
  // saldoAtual — mesmo espírito de `obterOuCriarEstoqueTravado` no Kardex,
  // mais simples aqui porque a linha de ContaFinanceira sempre já existe
  // (criada explicitamente via cadastro, nunca preguiçosamente).
  const contaTravada = await tx.$queryRaw<{ id: string; saldo_atual: string; empresa_id: string }[]>`
    SELECT id, saldo_atual, empresa_id FROM contas_financeiras WHERE id = ${input.contaId} FOR UPDATE
  `;
  const conta = contaTravada[0];
  if (!conta || conta.empresa_id !== lancamento.empresaId) {
    throw new Error("Conta financeira não encontrada.");
  }
  const saldoAnterior = new Prisma.Decimal(conta.saldo_atual);

  const sinal = lancamento.tipo === "despesa" ? -1 : 1;
  const valorAssinado = valorBaixado.times(sinal);
  const saldoPosterior = saldoAnterior.plus(valorAssinado);
  const tipoMovimentacao = lancamento.tipo === "despesa" ? "baixa_despesa" : "baixa_receita";

  const movimentacao = await tx.movimentacaoFinanceira.create({
    data: {
      empresaId: lancamento.empresaId,
      contaId: input.contaId,
      tipo: tipoMovimentacao,
      valor: valorAssinado,
      saldoAnterior,
      saldoPosterior,
      lancamentoId: lancamento.id,
      clienteId: lancamento.clienteId,
      fornecedorId: lancamento.fornecedorId,
      documento: lancamento.documento,
      descricao: lancamento.historicoSimplificado,
    },
  });

  const baixa = await tx.baixa.create({
    data: {
      lancamentoId: lancamento.id,
      contaId: input.contaId,
      valorBaixado,
      retencoes: totalRetencoes,
      dataBaixa: input.dataBaixa,
      juros: input.juros,
      multa: input.multa,
      desconto: input.desconto,
      historicoComplementar: input.historicoComplementar || null,
      movimentacaoId: movimentacao.id,
      usuarioId: input.usuarioId ?? null,
      adiantamentoClienteId: input.adiantamentoClienteId ?? null,
      adiantamentoFornecedorId: input.adiantamentoFornecedorId ?? null,
    },
  });

  await tx.contaFinanceira.update({ where: { id: input.contaId }, data: { saldoAtual: saldoPosterior } });
  await tx.lancamentoFinanceiro.update({ where: { id: lancamento.id }, data: { status: "baixado" } });

  // Baixa via conta de adiantamento consome o saldo daquele cliente/fornecedor
  // específico — pra creditar esse saldo, ver `registrarTransferenciaNaTransacao`.
  if (input.adiantamentoClienteId) {
    await tx.saldoAdiantamentoTerceiro.upsert({
      where: { contaId_clienteId: { contaId: input.contaId, clienteId: input.adiantamentoClienteId } },
      create: { contaId: input.contaId, clienteId: input.adiantamentoClienteId, saldoAtual: valorBaixado.negated() },
      update: { saldoAtual: { decrement: valorBaixado } },
    });
  }
  if (input.adiantamentoFornecedorId) {
    await tx.saldoAdiantamentoTerceiro.upsert({
      where: { contaId_fornecedorId: { contaId: input.contaId, fornecedorId: input.adiantamentoFornecedorId } },
      create: { contaId: input.contaId, fornecedorId: input.adiantamentoFornecedorId, saldoAtual: valorBaixado.negated() },
      update: { saldoAtual: { decrement: valorBaixado } },
    });
  }

  await creditarOuDebitarComissoesNaBaixa(tx, lancamento, baixa);

  return { baixa, movimentacao };
}

/**
 * Efeito colateral da Baixa na "conta corrente" de comissão do vendedor —
 * Receita credita (entrada), Despesa debita (saída), uma linha de
 * `MovimentacaoComissaoVendedor` por `Comissao` do lançamento (podem ser
 * vários vendedores). `Comissao.status` vira `paga` (creditada, se receita;
 * efetivamente paga, se despesa) só depois desse débito/crédito acontecer —
 * nunca na simples criação do Lançamento.
 */
async function creditarOuDebitarComissoesNaBaixa(
  tx: Prisma.TransactionClient,
  lancamento: { id: string; tipo: "receita" | "despesa"; historicoSimplificado: string },
  baixa: Baixa
) {
  const comissoes = await tx.comissao.findMany({ where: { lancamentoId: lancamento.id } });
  if (comissoes.length === 0) return;

  const tipoMovimento = lancamento.tipo === "receita" ? "entrada" : "saida";
  const sinal = lancamento.tipo === "receita" ? 1 : -1;
  const descricao = `${lancamento.tipo === "receita" ? "Comissão de venda" : "Pagamento de comissão"} — ${lancamento.historicoSimplificado}`;

  for (const comissao of comissoes) {
    // Uma de cada vez (não em paralelo) — cada linha precisa do saldoAtual
    // já atualizado pela anterior pra computar seu próprio saldoAnterior/Posterior.
    const vendedor = await tx.vendedor.findUniqueOrThrow({ where: { id: comissao.vendedorId } });
    const saldoAnterior = vendedor.saldoComissao;
    const saldoPosterior = saldoAnterior.plus(comissao.valor.times(sinal));

    await tx.movimentacaoComissaoVendedor.create({
      data: {
        vendedorId: comissao.vendedorId,
        tipo: tipoMovimento,
        valor: comissao.valor,
        saldoAnterior,
        saldoPosterior,
        comissaoId: comissao.id,
        baixaId: baixa.id,
        descricao,
      },
    });
    await tx.vendedor.update({ where: { id: comissao.vendedorId }, data: { saldoComissao: saldoPosterior } });
    await tx.comissao.update({ where: { id: comissao.id }, data: { status: "paga" } });
  }
}

/** Dá baixa num Lançamento Financeiro: grava o ledger (`MovimentacaoFinanceira`), atualiza `saldoAtual` da conta e marca o lançamento como `baixado`. */
export async function registrarBaixa(
  input: RegistrarBaixaInput
): Promise<{ baixa: Baixa; movimentacao: MovimentacaoFinanceira }> {
  return db.$transaction((tx) => registrarBaixaNaTransacao(tx, input));
}

export type RegistrarEstornoInput = {
  baixaId: string;
  contaId: string;
  motivo: string;
  dataEstorno: Date;
  alineaDevolucaoId?: string;
};

const TIPOS_DOCUMENTO_CHEQUE = new Set(["cheque_vista", "cheque_prazo"]);

/**
 * Mesma lógica de `registrarEstorno`, mas recebendo a transação de fora —
 * mesmo par bare/`NaTransacao` de `registrarBaixaNaTransacao`/`kardex.ts`.
 * A conta do estorno normalmente é a mesma da Baixa original — só pode
 * divergir quando a Baixa foi de cheque (regra aplicada na Server Action,
 * não aqui: esta função sempre trava e usa a conta que vier em `input`).
 * Gera um `MovimentacaoFinanceira` com o sinal exatamente oposto ao da baixa
 * (reversão exata do valor, sem recalcular nada), recredita o saldo de
 * adiantamento por terceiro se a Baixa tiver consumido um, e devolve o
 * Lançamento pro status `aberto` — pode receber uma nova Baixa depois
 * (`Baixa.lancamentoId` deixou de ser único, ver schema).
 */
export async function registrarEstornoNaTransacao(
  tx: Prisma.TransactionClient,
  input: RegistrarEstornoInput
): Promise<{ estorno: Estorno; movimentacao: MovimentacaoFinanceira }> {
  const baixa = await tx.baixa.findUniqueOrThrow({
    where: { id: input.baixaId },
    include: { lancamento: true },
  });
  if (baixa.estornada) {
    throw new Error("Esta baixa já foi estornada.");
  }
  if (input.dataEstorno.getTime() < baixa.dataBaixa.getTime()) {
    throw new Error("O estorno não pode ser anterior à data da baixa original.");
  }

  const ultimoFechamento = await obterUltimoFechamentoAtivo(tx, baixa.lancamento.empresaId);
  validarDataDeMovimento(input.dataEstorno, ultimoFechamento);

  // Mesma trava de linha de `registrarBaixaNaTransacao` — sem ::uuid, a
  // coluna é TEXT (lição da leva anterior: comparar text = uuid não existe).
  const contaTravada = await tx.$queryRaw<{ id: string; saldo_atual: string; empresa_id: string }[]>`
    SELECT id, saldo_atual, empresa_id FROM contas_financeiras WHERE id = ${input.contaId} FOR UPDATE
  `;
  const conta = contaTravada[0];
  if (!conta || conta.empresa_id !== baixa.lancamento.empresaId) {
    throw new Error("Conta financeira não encontrada.");
  }
  const saldoAnterior = new Prisma.Decimal(conta.saldo_atual);

  // Sinal exatamente oposto ao da baixa original: despesa baixada debitou
  // (negativo), o estorno credita de volta (positivo) — e vice-versa pra receita.
  const sinalOriginal = baixa.lancamento.tipo === "despesa" ? -1 : 1;
  const valorAssinado = baixa.valorBaixado.times(sinalOriginal).times(-1);
  const saldoPosterior = saldoAnterior.plus(valorAssinado);

  const movimentacao = await tx.movimentacaoFinanceira.create({
    data: {
      empresaId: baixa.lancamento.empresaId,
      contaId: input.contaId,
      tipo: "estorno_baixa",
      valor: valorAssinado,
      saldoAnterior,
      saldoPosterior,
      lancamentoId: baixa.lancamentoId,
      clienteId: baixa.lancamento.clienteId,
      fornecedorId: baixa.lancamento.fornecedorId,
      descricao: `Estorno — ${baixa.lancamento.historicoSimplificado}`,
    },
  });

  const estorno = await tx.estorno.create({
    data: {
      baixaId: baixa.id,
      contaId: input.contaId,
      motivo: input.motivo,
      dataEstorno: input.dataEstorno,
      alineaDevolucaoId: input.alineaDevolucaoId || null,
      movimentacaoId: movimentacao.id,
    },
  });

  await tx.contaFinanceira.update({ where: { id: input.contaId }, data: { saldoAtual: saldoPosterior } });
  await tx.baixa.update({ where: { id: baixa.id }, data: { estornada: true } });

  await tx.lancamentoFinanceiro.update({
    where: { id: baixa.lancamentoId },
    data: {
      status: "aberto",
      tipoDocumento: TIPOS_DOCUMENTO_CHEQUE.has(baixa.lancamento.tipoDocumento) ? "cheque_devolvido" : undefined,
    },
  });

  // Recredita o saldo de adiantamento por terceiro que a Baixa original
  // consumiu — sempre contra `baixa.contaId` (onde o débito aconteceu),
  // mesmo que o estorno em si tenha sido feito noutra conta (cheque).
  if (baixa.adiantamentoClienteId) {
    await tx.saldoAdiantamentoTerceiro.upsert({
      where: { contaId_clienteId: { contaId: baixa.contaId, clienteId: baixa.adiantamentoClienteId } },
      create: { contaId: baixa.contaId, clienteId: baixa.adiantamentoClienteId, saldoAtual: baixa.valorBaixado },
      update: { saldoAtual: { increment: baixa.valorBaixado } },
    });
  }
  if (baixa.adiantamentoFornecedorId) {
    await tx.saldoAdiantamentoTerceiro.upsert({
      where: { contaId_fornecedorId: { contaId: baixa.contaId, fornecedorId: baixa.adiantamentoFornecedorId } },
      create: { contaId: baixa.contaId, fornecedorId: baixa.adiantamentoFornecedorId, saldoAtual: baixa.valorBaixado },
      update: { saldoAtual: { increment: baixa.valorBaixado } },
    });
  }

  await reverterComissoesDaBaixa(tx, baixa.lancamento, baixa);

  return { estorno, movimentacao };
}

/** Reverte o que `creditarOuDebitarComissoesNaBaixa` fez — sinal invertido, mesma `Comissao` volta a `pendente`. */
async function reverterComissoesDaBaixa(
  tx: Prisma.TransactionClient,
  lancamento: { id: string; tipo: "receita" | "despesa"; historicoSimplificado: string },
  baixaOriginal: Baixa
) {
  const movimentos = await tx.movimentacaoComissaoVendedor.findMany({ where: { baixaId: baixaOriginal.id } });
  if (movimentos.length === 0) return;

  const tipoReverso = lancamento.tipo === "receita" ? "saida" : "entrada";
  const sinalReverso = lancamento.tipo === "receita" ? -1 : 1;
  const descricao = `Estorno — ${lancamento.tipo === "receita" ? "Comissão de venda" : "Pagamento de comissão"} — ${lancamento.historicoSimplificado}`;

  for (const mov of movimentos) {
    const vendedor = await tx.vendedor.findUniqueOrThrow({ where: { id: mov.vendedorId } });
    const saldoAnterior = vendedor.saldoComissao;
    const saldoPosterior = saldoAnterior.plus(mov.valor.times(sinalReverso));

    await tx.movimentacaoComissaoVendedor.create({
      data: {
        vendedorId: mov.vendedorId,
        tipo: tipoReverso,
        valor: mov.valor,
        saldoAnterior,
        saldoPosterior,
        comissaoId: mov.comissaoId,
        baixaId: baixaOriginal.id,
        descricao,
      },
    });
    await tx.vendedor.update({ where: { id: mov.vendedorId }, data: { saldoComissao: saldoPosterior } });
    await tx.comissao.update({ where: { id: mov.comissaoId }, data: { status: "pendente" } });
  }
}

/** Estorna uma Baixa: grava o ledger inverso, atualiza o saldo e reabre o Lançamento pra uma nova Baixa. */
export async function registrarEstorno(
  input: RegistrarEstornoInput
): Promise<{ estorno: Estorno; movimentacao: MovimentacaoFinanceira }> {
  return db.$transaction((tx) => registrarEstornoNaTransacao(tx, input));
}

/**
 * Próximo dia que "Fechar o dia" fecharia (`último fechamento ativo + 1
 * dia`, ou hoje se não houver nenhum ainda) — pura, sem tocar no banco, pra
 * ser reusada tanto por `fecharDia` quanto pela tela (decidir se mostra o
 * botão e qual data exibir nele) sem duplicar a conta.
 */
export function calcularProximoDiaAFechar(ultimoFechamento: FechamentoDiario | null): Date {
  return ultimoFechamento
    ? new Date(inicioDoDia(ultimoFechamento.data).getTime() + 86400000)
    : inicioDoDia(new Date());
}

/**
 * Fecha exatamente o próximo dia esperado — nunca uma data escolhida
 * livremente, garantindo a sequência "sem quebras" decidida com o usuário.
 */
export async function fecharDia(
  tx: Prisma.TransactionClient | typeof db,
  empresaId: string,
  usuarioId: string
): Promise<FechamentoDiario> {
  const ultimo = await obterUltimoFechamentoAtivo(tx, empresaId);
  const proximo = calcularProximoDiaAFechar(ultimo);
  const hoje = inicioDoDia(new Date());

  if (proximo.getTime() > hoje.getTime()) {
    throw new Error("O dia de hoje já está fechado.");
  }

  const fechamento = await tx.fechamentoDiario.create({ data: { empresaId, data: proximo, fechadoPorId: usuarioId } });

  // Se o dia fechado é o último do mês (o próximo já vira dia 1), tira o
  // snapshot mensal de saldo de cada conta — chamado aqui, não numa tela à
  // parte, porque só faz sentido depois que o mês inteiro está fechado.
  const diaSeguinte = new Date(proximo.getTime() + 86400000);
  if (diaSeguinte.getDate() === 1) {
    await snapshotSaldoMensalNaTransacao(tx, empresaId, proximo);
  }

  return fechamento;
}

/** Tira o snapshot de saldo inicial/final de cada Conta Financeira pro mês que `diaFechado` encerra. */
async function snapshotSaldoMensalNaTransacao(
  tx: Prisma.TransactionClient | typeof db,
  empresaId: string,
  diaFechado: Date
) {
  const competencia = new Date(diaFechado.getFullYear(), diaFechado.getMonth(), 1);
  const competenciaAnterior = new Date(diaFechado.getFullYear(), diaFechado.getMonth() - 1, 1);

  const contas = await tx.contaFinanceira.findMany({ where: { empresaId } });
  for (const conta of contas) {
    const snapshotAnterior = await tx.saldoMensalConta.findUnique({
      where: { contaId_competencia: { contaId: conta.id, competencia: competenciaAnterior } },
    });
    const saldoInicial = snapshotAnterior?.saldoFinal ?? conta.saldoInicial;

    await tx.saldoMensalConta.upsert({
      where: { contaId_competencia: { contaId: conta.id, competencia } },
      create: { contaId: conta.id, competencia, saldoInicial, saldoFinal: conta.saldoAtual },
      update: { saldoFinal: conta.saldoAtual },
    });
  }
}

/** Reabre o fechamento ativo mais recente — nunca um do meio da sequência, só o último. */
export async function reabrirDia(
  tx: Prisma.TransactionClient | typeof db,
  empresaId: string,
  usuarioId: string
): Promise<FechamentoDiario> {
  const ultimo = await obterUltimoFechamentoAtivo(tx, empresaId);
  if (!ultimo) {
    throw new Error("Não há fechamento ativo para reabrir.");
  }

  return tx.fechamentoDiario.update({
    where: { id: ultimo.id },
    data: { ativo: false, reabertoEm: new Date(), reabertoPorId: usuarioId },
  });
}

export type RegistrarTransferenciaInput = {
  empresaId: string;
  /** Omitido só quando tipoMovimento = emprestimo_contraido_banco (dinheiro novo, sem conta de origem). */
  contaOrigemId?: string;
  contaDestinoId: string;
  tipoMovimento: TipoMovimentoTransferencia;
  valor: Prisma.Decimal;
  data: Date;
  historico?: string;
  usuarioId?: string;
  /** Terceiro do adiantamento em cada lado — exigido conforme a flag da respectiva conta. Nunca cliente+fornecedor no mesmo lado. */
  origemClienteId?: string;
  origemFornecedorId?: string;
  destinoClienteId?: string;
  destinoFornecedorId?: string;
};

/**
 * Move dinheiro entre duas contas da própria empresa (ou credita uma conta
 * "do nada" no caso de empréstimo contraído) — `MovimentacaoFinanceira`
 * saída/entrada (cruzando `contaDestinoId` pra rastreio) mais um
 * `TransferenciaEntreContas` amarrando os dois. Se a conta de qualquer lado
 * for de adiantamento (cliente ou fornecedor), credita/debita o saldo
 * daquele terceiro específico em `SaldoAdiantamentoTerceiro` — é o único
 * jeito de "abastecer" esse saldo hoje (Baixa só consome). Empréstimo
 * contraído grava `planoId` (de `ParametroFinanceiro.planoEmprestimoId`) por
 * afetar fluxo de caixa de verdade, ao contrário das demais Transferências
 * (pura realocação de recurso já disponível).
 */
export async function registrarTransferenciaNaTransacao(
  tx: Prisma.TransactionClient,
  input: RegistrarTransferenciaInput
): Promise<TransferenciaEntreContas> {
  const regra = REGRAS_TRANSFERENCIA[input.tipoMovimento];
  if (regra.semOrigem !== !input.contaOrigemId) {
    throw new Error(regra.semOrigem ? "Empréstimo contraído não tem conta de origem." : "Selecione a conta de origem.");
  }
  if (input.contaOrigemId && input.contaOrigemId === input.contaDestinoId) {
    throw new Error("A conta de origem e a de destino não podem ser a mesma.");
  }
  if (!input.valor.greaterThan(0)) {
    throw new Error("O valor deve ser maior que zero.");
  }

  const ultimoFechamento = await obterUltimoFechamentoAtivo(tx, input.empresaId);
  validarDataDeMovimento(input.data, ultimoFechamento);

  // Trava as contas envolvidas em ordem determinística (menor id primeiro)
  // pra evitar deadlock entre transferências concorrentes em sentidos
  // opostos — mesmo espírito de `registrarTransferenciaNaTransacao` no kardex.ts.
  const idsContas = input.contaOrigemId ? [input.contaOrigemId, input.contaDestinoId].sort() : [input.contaDestinoId];
  const contasTravadas = await tx.$queryRaw<{ id: string; saldo_atual: string; empresa_id: string }[]>`
    SELECT id, saldo_atual, empresa_id FROM contas_financeiras WHERE id IN (${Prisma.join(idsContas)}) ORDER BY id FOR UPDATE
  `;
  const contaOrigem = input.contaOrigemId ? contasTravadas.find((c) => c.id === input.contaOrigemId) : undefined;
  const contaDestino = contasTravadas.find((c) => c.id === input.contaDestinoId);
  if (input.contaOrigemId && (!contaOrigem || contaOrigem.empresa_id !== input.empresaId)) {
    throw new Error("Conta de origem não encontrada.");
  }
  if (!contaDestino || contaDestino.empresa_id !== input.empresaId) throw new Error("Conta de destino não encontrada.");

  const [origemCompleta, destinoCompleto] = await Promise.all([
    input.contaOrigemId ? tx.contaFinanceira.findUniqueOrThrow({ where: { id: input.contaOrigemId } }) : null,
    tx.contaFinanceira.findUniqueOrThrow({ where: { id: input.contaDestinoId } }),
  ]);
  if (origemCompleta) {
    const erroOrigem = erroContaOrigemTransferencia(origemCompleta, input.tipoMovimento);
    if (erroOrigem) throw new Error(erroOrigem);
  }
  const erroDestino = erroContaDestinoTransferencia(destinoCompleto, input.tipoMovimento);
  if (erroDestino) throw new Error(erroDestino);

  if (origemCompleta?.adiantamentoCliente && !input.origemClienteId) throw new Error("Selecione o cliente do adiantamento de origem.");
  if (origemCompleta?.adiantamentoFornecedor && !input.origemFornecedorId) throw new Error("Selecione o fornecedor do adiantamento de origem.");
  if (destinoCompleto.adiantamentoCliente && !input.destinoClienteId) throw new Error("Selecione o cliente do adiantamento de destino.");
  if (destinoCompleto.adiantamentoFornecedor && !input.destinoFornecedorId) throw new Error("Selecione o fornecedor do adiantamento de destino.");

  let planoId: string | null = null;
  if (regra.afetaFluxoDeCaixa) {
    const parametro = await tx.parametroFinanceiro.findUnique({ where: { empresaId: input.empresaId } });
    if (!parametro?.planoEmprestimoId) {
      throw new Error("Configure o Plano Financeiro de Empréstimo Contraído em Parâmetros Financeiros antes de continuar.");
    }
    planoId = parametro.planoEmprestimoId;
  }

  const saldoAnteriorDestino = new Prisma.Decimal(contaDestino.saldo_atual);
  const saldoPosteriorDestino = saldoAnteriorDestino.plus(input.valor);
  const descricao = input.historico || "Transferência entre contas";

  let movSaidaId: string | null = null;
  if (contaOrigem) {
    const saldoAnteriorOrigem = new Prisma.Decimal(contaOrigem.saldo_atual);
    const saldoPosteriorOrigem = saldoAnteriorOrigem.minus(input.valor);
    const movSaida = await tx.movimentacaoFinanceira.create({
      data: {
        empresaId: input.empresaId,
        contaId: input.contaOrigemId!,
        contaDestinoId: input.contaDestinoId,
        tipo: "transferencia_saida",
        valor: input.valor.negated(),
        saldoAnterior: saldoAnteriorOrigem,
        saldoPosterior: saldoPosteriorOrigem,
        planoId,
        descricao,
      },
    });
    movSaidaId = movSaida.id;
    await tx.contaFinanceira.update({ where: { id: input.contaOrigemId! }, data: { saldoAtual: saldoPosteriorOrigem } });
  }

  const movEntrada = await tx.movimentacaoFinanceira.create({
    data: {
      empresaId: input.empresaId,
      contaId: input.contaDestinoId,
      contaDestinoId: input.contaOrigemId ?? null,
      tipo: "transferencia_entrada",
      valor: input.valor,
      saldoAnterior: saldoAnteriorDestino,
      saldoPosterior: saldoPosteriorDestino,
      planoId,
      descricao,
    },
  });
  await tx.contaFinanceira.update({ where: { id: input.contaDestinoId }, data: { saldoAtual: saldoPosteriorDestino } });

  // Empréstimo contraído não tem perna de saída (sem origem) — usa a mesma
  // movimentação de entrada nos dois lados do vínculo só pra satisfazer a FK
  // obrigatória de movSaidaId; não representa uma segunda movimentação real.
  const transferencia = await tx.transferenciaEntreContas.create({
    data: {
      empresaId: input.empresaId,
      tipoMovimento: input.tipoMovimento,
      contaOrigemId: input.contaOrigemId ?? input.contaDestinoId,
      contaDestinoId: input.contaDestinoId,
      valor: input.valor,
      historico: input.historico || null,
      data: input.data,
      movSaidaId: movSaidaId ?? movEntrada.id,
      movEntradaId: movEntrada.id,
      usuarioId: input.usuarioId ?? null,
      origemClienteId: origemCompleta?.adiantamentoCliente ? input.origemClienteId : null,
      origemFornecedorId: origemCompleta?.adiantamentoFornecedor ? input.origemFornecedorId : null,
      destinoClienteId: destinoCompleto.adiantamentoCliente ? input.destinoClienteId : null,
      destinoFornecedorId: destinoCompleto.adiantamentoFornecedor ? input.destinoFornecedorId : null,
    },
  });

  if (origemCompleta?.adiantamentoCliente && input.origemClienteId) {
    await tx.saldoAdiantamentoTerceiro.upsert({
      where: { contaId_clienteId: { contaId: input.contaOrigemId!, clienteId: input.origemClienteId } },
      create: { contaId: input.contaOrigemId!, clienteId: input.origemClienteId, saldoAtual: input.valor.negated() },
      update: { saldoAtual: { decrement: input.valor } },
    });
  }
  if (origemCompleta?.adiantamentoFornecedor && input.origemFornecedorId) {
    await tx.saldoAdiantamentoTerceiro.upsert({
      where: { contaId_fornecedorId: { contaId: input.contaOrigemId!, fornecedorId: input.origemFornecedorId } },
      create: { contaId: input.contaOrigemId!, fornecedorId: input.origemFornecedorId, saldoAtual: input.valor.negated() },
      update: { saldoAtual: { decrement: input.valor } },
    });
  }
  if (destinoCompleto.adiantamentoCliente && input.destinoClienteId) {
    await tx.saldoAdiantamentoTerceiro.upsert({
      where: { contaId_clienteId: { contaId: input.contaDestinoId, clienteId: input.destinoClienteId } },
      create: { contaId: input.contaDestinoId, clienteId: input.destinoClienteId, saldoAtual: input.valor },
      update: { saldoAtual: { increment: input.valor } },
    });
  }
  if (destinoCompleto.adiantamentoFornecedor && input.destinoFornecedorId) {
    await tx.saldoAdiantamentoTerceiro.upsert({
      where: { contaId_fornecedorId: { contaId: input.contaDestinoId, fornecedorId: input.destinoFornecedorId } },
      create: { contaId: input.contaDestinoId, fornecedorId: input.destinoFornecedorId, saldoAtual: input.valor },
      update: { saldoAtual: { increment: input.valor } },
    });
  }

  return transferencia;
}

/** Registra uma Transferência Entre Contas: grava o ledger cruzado e atualiza os saldos envolvidos. */
export async function registrarTransferencia(input: RegistrarTransferenciaInput): Promise<TransferenciaEntreContas> {
  return db.$transaction((tx) => registrarTransferenciaNaTransacao(tx, input));
}

export type RegistrarEstornoTransferenciaInput = {
  transferenciaId: string;
  motivo: string;
  dataEstorno: Date;
  usuarioId?: string;
};

/**
 * Estorna uma Transferência: cria uma segunda transferência reversa
 * (contaDestino → contaOrigem original), marca a original como `estornada` e
 * devolve o saldo de adiantamento por terceiro que ela tivesse creditado.
 * Sem model dedicado de estorno aqui (diferente de Baixa/Estorno) — a
 * reversa é só mais uma linha da mesma tabela, referenciada via `estornoDeId`.
 */
export async function registrarEstornoTransferenciaNaTransacao(
  tx: Prisma.TransactionClient,
  input: RegistrarEstornoTransferenciaInput
): Promise<TransferenciaEntreContas> {
  const original = await tx.transferenciaEntreContas.findUniqueOrThrow({ where: { id: input.transferenciaId } });
  if (original.estornada) {
    throw new Error("Esta transferência já foi estornada.");
  }
  // Empréstimo contraído grava contaOrigemId = contaDestinoId (sentinela —
  // não existe conta de origem de verdade, ver registrarTransferenciaNaTransacao).
  const semOrigemReal = original.contaOrigemId === original.contaDestinoId;

  const ultimoFechamento = await obterUltimoFechamentoAtivo(tx, original.empresaId);
  validarDataDeMovimento(input.dataEstorno, ultimoFechamento);

  const idsContas = semOrigemReal ? [original.contaDestinoId] : [original.contaOrigemId, original.contaDestinoId].sort();
  const contasTravadas = await tx.$queryRaw<{ id: string; saldo_atual: string; empresa_id: string }[]>`
    SELECT id, saldo_atual, empresa_id FROM contas_financeiras WHERE id IN (${Prisma.join(idsContas)}) ORDER BY id FOR UPDATE
  `;
  const contaOrigemOriginal = semOrigemReal ? undefined : contasTravadas.find((c) => c.id === original.contaOrigemId)!;
  const contaDestinoOriginal = contasTravadas.find((c) => c.id === original.contaDestinoId)!;

  // Sentido invertido: a origem original recebe de volta, o destino original devolve
  // (ou só devolve, sem ninguém recebendo, no caso de empréstimo contraído).
  const saldoAnteriorDestino = new Prisma.Decimal(contaDestinoOriginal.saldo_atual);
  const saldoPosteriorDestino = saldoAnteriorDestino.minus(original.valor);
  const descricao = `Estorno — ${original.historico || "Transferência entre contas"}`;

  let movEntradaEstornoId: string;
  if (semOrigemReal) {
    const movUnico = await tx.movimentacaoFinanceira.create({
      data: {
        empresaId: original.empresaId,
        contaId: original.contaDestinoId,
        tipo: "transferencia_saida",
        valor: original.valor.negated(),
        saldoAnterior: saldoAnteriorDestino,
        saldoPosterior: saldoPosteriorDestino,
        descricao,
      },
    });
    movEntradaEstornoId = movUnico.id;
  } else {
    const saldoAnteriorOrigem = new Prisma.Decimal(contaOrigemOriginal!.saldo_atual);
    const saldoPosteriorOrigem = saldoAnteriorOrigem.plus(original.valor);
    const movEntradaEstorno = await tx.movimentacaoFinanceira.create({
      data: {
        empresaId: original.empresaId,
        contaId: original.contaOrigemId,
        contaDestinoId: original.contaDestinoId,
        tipo: "transferencia_entrada",
        valor: original.valor,
        saldoAnterior: saldoAnteriorOrigem,
        saldoPosterior: saldoPosteriorOrigem,
        descricao,
      },
    });
    movEntradaEstornoId = movEntradaEstorno.id;
    await tx.movimentacaoFinanceira.create({
      data: {
        empresaId: original.empresaId,
        contaId: original.contaDestinoId,
        contaDestinoId: original.contaOrigemId,
        tipo: "transferencia_saida",
        valor: original.valor.negated(),
        saldoAnterior: saldoAnteriorDestino,
        saldoPosterior: saldoPosteriorDestino,
        descricao,
      },
    });
    await tx.contaFinanceira.update({ where: { id: original.contaOrigemId }, data: { saldoAtual: saldoPosteriorOrigem } });
  }

  const reversa = await tx.transferenciaEntreContas.create({
    data: {
      empresaId: original.empresaId,
      tipoMovimento: original.tipoMovimento,
      contaOrigemId: original.contaDestinoId,
      contaDestinoId: semOrigemReal ? original.contaDestinoId : original.contaOrigemId,
      valor: original.valor,
      historico: descricao,
      data: input.dataEstorno,
      movSaidaId: movEntradaEstornoId,
      movEntradaId: movEntradaEstornoId,
      usuarioId: input.usuarioId ?? null,
      estornoDeId: original.id,
    },
  });

  await tx.contaFinanceira.update({ where: { id: original.contaDestinoId }, data: { saldoAtual: saldoPosteriorDestino } });

  await tx.transferenciaEntreContas.update({
    where: { id: original.id },
    data: {
      estornada: true,
      motivoEstorno: input.motivo,
      estornadoEm: input.dataEstorno,
      estornadoPorId: input.usuarioId ?? null,
    },
  });

  if (original.origemClienteId) {
    await tx.saldoAdiantamentoTerceiro.update({
      where: { contaId_clienteId: { contaId: original.contaOrigemId, clienteId: original.origemClienteId } },
      data: { saldoAtual: { increment: original.valor } },
    });
  }
  if (original.origemFornecedorId) {
    await tx.saldoAdiantamentoTerceiro.update({
      where: { contaId_fornecedorId: { contaId: original.contaOrigemId, fornecedorId: original.origemFornecedorId } },
      data: { saldoAtual: { increment: original.valor } },
    });
  }
  if (original.destinoClienteId) {
    await tx.saldoAdiantamentoTerceiro.update({
      where: { contaId_clienteId: { contaId: original.contaDestinoId, clienteId: original.destinoClienteId } },
      data: { saldoAtual: { decrement: original.valor } },
    });
  }
  if (original.destinoFornecedorId) {
    await tx.saldoAdiantamentoTerceiro.update({
      where: { contaId_fornecedorId: { contaId: original.contaDestinoId, fornecedorId: original.destinoFornecedorId } },
      data: { saldoAtual: { decrement: original.valor } },
    });
  }

  return reversa;
}

/** Estorna uma Transferência Entre Contas — mesmo espírito de `registrarEstorno` para Baixa. */
export async function registrarEstornoTransferencia(
  input: RegistrarEstornoTransferenciaInput
): Promise<TransferenciaEntreContas> {
  return db.$transaction((tx) => registrarEstornoTransferenciaNaTransacao(tx, input));
}

export type RegistrarMovimentoAplicacaoInput = {
  empresaId: string;
  tipoMovimento: TipoMovimentoAplicacao;
  /** Obrigatório pra aplicacao_financeira/resgate_aplicacao; omitido (rendimento não sai de conta nenhuma) pra registro_rendimento. */
  daContaId?: string;
  paraContaId: string;
  valor: Prisma.Decimal;
  data: Date;
  usuarioId?: string;
};

/**
 * Aplicação/Resgate: transferência normal entre a conta de origem e a conta
 * de aplicação, só que com o Plano Financeiro vindo de `ParametroFinanceiro`
 * (configurado por empresa) em vez de rateio manual — não passa por
 * LancamentoFinanceiro. Rendimento: sem conta de origem, só credita a
 * própria conta de aplicação (dinheiro "nascendo" ali).
 */
export async function registrarMovimentoAplicacaoNaTransacao(
  tx: Prisma.TransactionClient,
  input: RegistrarMovimentoAplicacaoInput
): Promise<MovimentoAplicacao> {
  if (!input.valor.greaterThan(0)) {
    throw new Error("O valor deve ser maior que zero.");
  }
  if (input.tipoMovimento === "registro_rendimento" && input.daContaId) {
    throw new Error("Registro de rendimento não tem conta de origem.");
  }
  if (input.tipoMovimento !== "registro_rendimento" && !input.daContaId) {
    throw new Error("Selecione a conta de origem.");
  }

  const parametro = await tx.parametroFinanceiro.findUnique({ where: { empresaId: input.empresaId } });
  const planoId =
    input.tipoMovimento === "aplicacao_financeira"
      ? parametro?.planoAplicacaoId
      : input.tipoMovimento === "resgate_aplicacao"
        ? parametro?.planoResgateId
        : parametro?.planoRendimentoId;
  if (!planoId) {
    throw new Error("Configure o Plano Financeiro desse tipo de movimento em Parâmetros Financeiros antes de continuar.");
  }

  const ultimoFechamento = await obterUltimoFechamentoAtivo(tx, input.empresaId);
  validarDataDeMovimento(input.data, ultimoFechamento);

  const idsContas = input.daContaId ? [input.daContaId, input.paraContaId].sort() : [input.paraContaId];
  const contasTravadas = await tx.$queryRaw<{ id: string; saldo_atual: string; empresa_id: string }[]>`
    SELECT id, saldo_atual, empresa_id FROM contas_financeiras WHERE id IN (${Prisma.join(idsContas)}) ORDER BY id FOR UPDATE
  `;
  const contaOrigem = input.daContaId ? contasTravadas.find((c) => c.id === input.daContaId) : undefined;
  const contaDestino = contasTravadas.find((c) => c.id === input.paraContaId);
  if (input.daContaId && (!contaOrigem || contaOrigem.empresa_id !== input.empresaId)) {
    throw new Error("Conta de origem não encontrada.");
  }
  if (!contaDestino || contaDestino.empresa_id !== input.empresaId) {
    throw new Error("Conta de destino não encontrada.");
  }

  // O lado "comum" (não-aplicação) só pode ser Conta Corrente — nunca Caixa
  // nem Fundo Fixo. Em aplicação_financeira é a origem; em resgate é o
  // destino; rendimento não tem lado comum (fica de fora dessa checagem).
  if (input.tipoMovimento === "aplicacao_financeira") {
    const origemCompleta = await tx.contaFinanceira.findUniqueOrThrow({ where: { id: input.daContaId! } });
    const erro = erroContaComumParaAplicacao(origemCompleta.tipo);
    if (erro) throw new Error(erro);
  }
  if (input.tipoMovimento === "resgate_aplicacao") {
    const destinoCompleto = await tx.contaFinanceira.findUniqueOrThrow({ where: { id: input.paraContaId } });
    const erro = erroContaComumParaAplicacao(destinoCompleto.tipo);
    if (erro) throw new Error(erro);
  }

  // TipoMovimentoAplicacao.registro_rendimento vira rendimento_aplicacao em
  // TipoMovimentacaoFinanceira — nomes divergem entre os dois enums de propósito.
  const tipoMovimentacao = input.tipoMovimento === "registro_rendimento" ? "rendimento_aplicacao" : input.tipoMovimento;

  const saldoAnteriorDestino = new Prisma.Decimal(contaDestino.saldo_atual);
  const saldoPosteriorDestino = saldoAnteriorDestino.plus(input.valor);
  const descricao =
    input.tipoMovimento === "aplicacao_financeira"
      ? "Aplicação financeira"
      : input.tipoMovimento === "resgate_aplicacao"
        ? "Resgate de aplicação"
        : "Rendimento de aplicação";

  const movimentoAplicacao = await tx.movimentoAplicacao.create({
    data: {
      empresaId: input.empresaId,
      tipoMovimento: input.tipoMovimento,
      daContaId: input.daContaId ?? null,
      paraContaId: input.paraContaId,
      valor: input.valor,
      dataMovimento: input.data,
      usuarioId: input.usuarioId ?? null,
    },
  });

  if (contaOrigem) {
    const saldoAnteriorOrigem = new Prisma.Decimal(contaOrigem.saldo_atual);
    const saldoPosteriorOrigem = saldoAnteriorOrigem.minus(input.valor);
    await tx.movimentacaoFinanceira.create({
      data: {
        empresaId: input.empresaId,
        contaId: input.daContaId!,
        contaDestinoId: input.paraContaId,
        tipo: tipoMovimentacao,
        valor: input.valor.negated(),
        saldoAnterior: saldoAnteriorOrigem,
        saldoPosterior: saldoPosteriorOrigem,
        planoId,
        movimentoAplicacaoId: movimentoAplicacao.id,
        descricao,
      },
    });
    await tx.contaFinanceira.update({ where: { id: input.daContaId! }, data: { saldoAtual: saldoPosteriorOrigem } });
  }

  await tx.movimentacaoFinanceira.create({
    data: {
      empresaId: input.empresaId,
      contaId: input.paraContaId,
      contaDestinoId: input.daContaId ?? null,
      tipo: tipoMovimentacao,
      valor: input.valor,
      saldoAnterior: saldoAnteriorDestino,
      saldoPosterior: saldoPosteriorDestino,
      planoId,
      movimentoAplicacaoId: movimentoAplicacao.id,
      descricao,
    },
  });
  await tx.contaFinanceira.update({ where: { id: input.paraContaId }, data: { saldoAtual: saldoPosteriorDestino } });

  return movimentoAplicacao;
}

/** Registra Aplicação/Resgate/Rendimento numa conta do tipo `aplicacao`. */
export async function registrarMovimentoAplicacao(input: RegistrarMovimentoAplicacaoInput): Promise<MovimentoAplicacao> {
  return db.$transaction((tx) => registrarMovimentoAplicacaoNaTransacao(tx, input));
}

export type RegistrarEstornoMovimentoAplicacaoInput = {
  movimentoAplicacaoId: string;
  motivo: string;
  dataEstorno: Date;
  usuarioId?: string;
};

/** Estorna um MovimentoAplicacao: cria o movimento inverso (mesmo Plano Financeiro) e devolve os saldos. */
export async function registrarEstornoMovimentoAplicacaoNaTransacao(
  tx: Prisma.TransactionClient,
  input: RegistrarEstornoMovimentoAplicacaoInput
): Promise<MovimentoAplicacao> {
  const original = await tx.movimentoAplicacao.findUniqueOrThrow({ where: { id: input.movimentoAplicacaoId } });
  if (original.estornado) {
    throw new Error("Este movimento já foi estornado.");
  }

  const ultimoFechamento = await obterUltimoFechamentoAtivo(tx, original.empresaId);
  validarDataDeMovimento(input.dataEstorno, ultimoFechamento);

  const idsContas = original.daContaId ? [original.daContaId, original.paraContaId].sort() : [original.paraContaId];
  const contasTravadas = await tx.$queryRaw<{ id: string; saldo_atual: string; empresa_id: string }[]>`
    SELECT id, saldo_atual, empresa_id FROM contas_financeiras WHERE id IN (${Prisma.join(idsContas)}) ORDER BY id FOR UPDATE
  `;
  const contaOrigemOriginal = original.daContaId ? contasTravadas.find((c) => c.id === original.daContaId) : undefined;
  const contaDestinoOriginal = contasTravadas.find((c) => c.id === original.paraContaId)!;

  const tipoMovimentacao = original.tipoMovimento === "registro_rendimento" ? "rendimento_aplicacao" : original.tipoMovimento;
  const descricao = `Estorno — ${
    original.tipoMovimento === "aplicacao_financeira" ? "Aplicação financeira" : original.tipoMovimento === "resgate_aplicacao" ? "Resgate de aplicação" : "Rendimento de aplicação"
  }`;

  // Sentido invertido: quem recebeu devolve, quem deu recebe de volta.
  const saldoAnteriorDestino = new Prisma.Decimal(contaDestinoOriginal.saldo_atual);
  const saldoPosteriorDestino = saldoAnteriorDestino.minus(original.valor);

  if (contaOrigemOriginal) {
    const saldoAnteriorOrigem = new Prisma.Decimal(contaOrigemOriginal.saldo_atual);
    const saldoPosteriorOrigem = saldoAnteriorOrigem.plus(original.valor);
    await tx.movimentacaoFinanceira.create({
      data: {
        empresaId: original.empresaId,
        contaId: original.daContaId!,
        contaDestinoId: original.paraContaId,
        tipo: tipoMovimentacao,
        valor: original.valor,
        saldoAnterior: saldoAnteriorOrigem,
        saldoPosterior: saldoPosteriorOrigem,
        descricao,
      },
    });
    await tx.contaFinanceira.update({ where: { id: original.daContaId! }, data: { saldoAtual: saldoPosteriorOrigem } });
  }

  await tx.movimentacaoFinanceira.create({
    data: {
      empresaId: original.empresaId,
      contaId: original.paraContaId,
      contaDestinoId: original.daContaId ?? null,
      tipo: tipoMovimentacao,
      valor: original.valor.negated(),
      saldoAnterior: saldoAnteriorDestino,
      saldoPosterior: saldoPosteriorDestino,
      descricao,
    },
  });
  await tx.contaFinanceira.update({ where: { id: original.paraContaId }, data: { saldoAtual: saldoPosteriorDestino } });

  const reversa = await tx.movimentoAplicacao.create({
    data: {
      empresaId: original.empresaId,
      tipoMovimento: original.tipoMovimento,
      daContaId: original.paraContaId,
      paraContaId: original.daContaId ?? original.paraContaId,
      valor: original.valor,
      dataMovimento: input.dataEstorno,
      usuarioId: input.usuarioId ?? null,
      estornoDeId: original.id,
    },
  });

  await tx.movimentoAplicacao.update({
    where: { id: original.id },
    data: {
      estornado: true,
      motivoEstorno: input.motivo,
      estornadoEm: input.dataEstorno,
      estornadoPorId: input.usuarioId ?? null,
    },
  });

  return reversa;
}

/** Estorna um MovimentoAplicacao — mesmo espírito de `registrarEstornoTransferencia`. */
export async function registrarEstornoMovimentoAplicacao(
  input: RegistrarEstornoMovimentoAplicacaoInput
): Promise<MovimentoAplicacao> {
  return db.$transaction((tx) => registrarEstornoMovimentoAplicacaoNaTransacao(tx, input));
}
