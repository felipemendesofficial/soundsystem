import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export type PendenciaBanco = {
  id: string;
  tipo: "entrada" | "saida";
  data: Date;
  valor: Prisma.Decimal;
  comentario: string | null;
};

export type ResumoConciliacaoConta = {
  totalPendencias: Prisma.Decimal;
  saldoBanco: Prisma.Decimal;
  pendenciasBanco: PendenciaBanco[];
};

/**
 * Fórmula clássica de conciliação bancária: Saldo do banco = Saldo do
 * sistema − pendências da empresa (movimentos já lançados no sistema, banco
 * ainda não confirmou — ex.: depósito em trânsito, cheque emitido ainda não
 * compensado) + pendências do banco (o banco já processou, a empresa ainda
 * não reconheceu no sistema — ex.: tarifa, juros). As duas entram com sinal
 * oposto na mesma conta porque puxam o saldo bancário real em direções
 * opostas: uma pendência da empresa faz o sistema "parecer" diferente do
 * banco (o sistema já contou algo que o banco ainda não viu); uma pendência
 * do banco é o inverso (o banco já contou algo que o sistema ainda não viu).
 * `totalPendencias` aqui já é essa combinação líquida — é o número que,
 * subtraído do saldo do sistema, dá o saldo do banco.
 */
export async function obterResumoConciliacao(contaId: string, saldoAtual: Prisma.Decimal): Promise<ResumoConciliacaoConta> {
  const [{ _sum }, pendenciasBanco] = await Promise.all([
    db.movimentacaoFinanceira.aggregate({
      where: { contaId, statusConciliacao: "pendente" },
      _sum: { valor: true },
    }),
    db.pendenciaConciliacao.findMany({
      where: { contaId, resolvidoEm: null },
      orderBy: { data: "desc" },
      select: { id: true, tipo: true, data: true, valor: true, comentario: true },
    }),
  ]);

  const pendenciasEmpresa = _sum.valor ?? new Prisma.Decimal(0);
  const pendenciasBancoAssinado = pendenciasBanco.reduce(
    (acc, p) => acc.plus(p.tipo === "entrada" ? p.valor : p.valor.negated()),
    new Prisma.Decimal(0)
  );

  const totalPendencias = pendenciasEmpresa.minus(pendenciasBancoAssinado);
  const saldoBanco = saldoAtual.minus(totalPendencias);

  return { totalPendencias, saldoBanco, pendenciasBanco };
}
