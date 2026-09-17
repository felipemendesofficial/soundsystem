import { Prisma } from "@/generated/prisma/client";

const MS_POR_DIA = 1000 * 60 * 60 * 24;

/**
 * Juros de mora pro-rata simples (sem juros compostos), mês sempre dividido
 * por 30 dias fixos — suposição registrada nas notas de design do módulo
 * financeiro, não confirmada contra um sistema legado. Ajustar aqui se o
 * critério real for outro (juros compostos, mês comercial, carência).
 */
export function calcularJurosMora(
  valorOriginal: Prisma.Decimal,
  moraMes: Prisma.Decimal | null,
  dataVencimento: Date,
  dataBaixa: Date
): Prisma.Decimal {
  if (!moraMes) return new Prisma.Decimal(0);

  const diasAtraso = Math.max(0, Math.floor((dataBaixa.getTime() - dataVencimento.getTime()) / MS_POR_DIA));
  if (diasAtraso === 0) return new Prisma.Decimal(0);

  // moraMes é uma taxa em "% ao mês" (ex.: 2 = 2%), por isso o /100 extra —
  // a fórmula das notas de design ("valor × (moraMes/30) × diasAtraso") lista
  // moraMes já como fração; mantendo-a como percentual (como o campo é
  // documentado no schema e como os demais campos `percentual` do módulo são
  // armazenados) exige essa normalização, senão o resultado fica 100x maior.
  return valorOriginal.times(moraMes.dividedBy(30)).times(diasAtraso).dividedBy(100);
}
