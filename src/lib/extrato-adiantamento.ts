import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export type LinhaExtratoAdiantamento = {
  data: Date;
  descricao: string;
  valor: Prisma.Decimal;
  saldoAnterior: Prisma.Decimal;
  saldoPosterior: Prisma.Decimal;
};

type Terceiro = { clienteId: string } | { fornecedorId: string };

/**
 * Reconstrói o extrato linha-a-linha de um saldo de adiantamento por terceiro
 * numa conta específica. Não existe um model de ledger dedicado pra esse
 * saldo (diferente de MovimentacaoFinanceira/MovimentacaoComissaoVendedor) —
 * `SaldoAdiantamentoTerceiro` guarda só o total corrente, mutado em 4 pontos
 * de `financeiro-ledger.ts` (baixa, estorno de baixa, transferência,
 * estorno de transferência). Esta função relê exatamente essas 4 fontes e
 * "reproduz" o saldo em ordem cronológica pra exibir o histórico completo.
 */
export async function obterExtratoAdiantamento(
  contaId: string,
  terceiro: Terceiro
): Promise<LinhaExtratoAdiantamento[]> {
  const isCliente = "clienteId" in terceiro;
  const id = isCliente ? terceiro.clienteId : terceiro.fornecedorId;

  const baixas = await db.baixa.findMany({
    where: { contaId, ...(isCliente ? { adiantamentoClienteId: id } : { adiantamentoFornecedorId: id }) },
    include: { lancamento: true, estorno: true },
  });

  const transferencias = await db.transferenciaEntreContas.findMany({
    where: {
      OR: [
        { contaOrigemId: contaId, ...(isCliente ? { origemClienteId: id } : { origemFornecedorId: id }) },
        { contaDestinoId: contaId, ...(isCliente ? { destinoClienteId: id } : { destinoFornecedorId: id }) },
      ],
    },
  });

  type Evento = { data: Date; descricao: string; valor: Prisma.Decimal };
  const eventos: Evento[] = [];

  for (const b of baixas) {
    eventos.push({
      data: b.dataBaixa,
      descricao: `Baixa — ${b.lancamento.historicoSimplificado}`,
      valor: b.valorBaixado.negated(),
    });
    if (b.estorno) {
      eventos.push({
        data: b.estorno.dataEstorno,
        descricao: `Estorno de baixa — ${b.lancamento.historicoSimplificado}`,
        valor: b.valorBaixado,
      });
    }
  }

  for (const t of transferencias) {
    const ehOrigem = t.contaOrigemId === contaId && (isCliente ? t.origemClienteId === id : t.origemFornecedorId === id);
    const ehDestino = t.contaDestinoId === contaId && (isCliente ? t.destinoClienteId === id : t.destinoFornecedorId === id);
    const descricao = t.historico || "Transferência entre contas";
    if (ehOrigem) {
      eventos.push({ data: t.data, descricao, valor: t.valor.negated() });
      if (t.estornada && t.estornadoEm) {
        eventos.push({ data: t.estornadoEm, descricao: `Estorno — ${descricao}`, valor: t.valor });
      }
    }
    if (ehDestino) {
      eventos.push({ data: t.data, descricao, valor: t.valor });
      if (t.estornada && t.estornadoEm) {
        eventos.push({ data: t.estornadoEm, descricao: `Estorno — ${descricao}`, valor: t.valor.negated() });
      }
    }
  }

  eventos.sort((a, b) => a.data.getTime() - b.data.getTime());

  let saldo = new Prisma.Decimal(0);
  return eventos.map((e) => {
    const saldoAnterior = saldo;
    saldo = saldo.plus(e.valor);
    return { ...e, saldoAnterior, saldoPosterior: saldo };
  });
}
