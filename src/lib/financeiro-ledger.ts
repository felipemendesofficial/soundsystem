import { db } from "@/lib/db";
import { Prisma, type Baixa, type Estorno, type FechamentoDiario, type MovimentacaoFinanceira } from "@/generated/prisma/client";

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

  const valorBaixado = lancamento.valorOriginal.plus(input.juros).plus(input.multa).minus(input.desconto);
  if (valorBaixado.lessThan(0)) {
    throw new Error("Juros + multa − desconto não pode deixar o valor a baixar negativo.");
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
      dataBaixa: input.dataBaixa,
      juros: input.juros,
      multa: input.multa,
      desconto: input.desconto,
      historicoComplementar: input.historicoComplementar || null,
      movimentacaoId: movimentacao.id,
    },
  });

  await tx.contaFinanceira.update({ where: { id: input.contaId }, data: { saldoAtual: saldoPosterior } });
  await tx.lancamentoFinanceiro.update({ where: { id: lancamento.id }, data: { status: "baixado" } });

  return { baixa, movimentacao };
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
 * A conta do estorno é livre (pode diferir da conta original da Baixa —
 * decisão do usuário) — por isso trava a conta escolhida aqui, não a da
 * Baixa original. Gera um `MovimentacaoFinanceira` com o sinal exatamente
 * oposto ao da baixa (reversão exata do valor, sem recalcular nada), e
 * devolve o Lançamento pro status `aberto` — pode receber uma nova Baixa
 * depois (`Baixa.lancamentoId` deixou de ser único, ver schema).
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

  return { estorno, movimentacao };
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

  return tx.fechamentoDiario.create({ data: { empresaId, data: proximo, fechadoPorId: usuarioId } });
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
