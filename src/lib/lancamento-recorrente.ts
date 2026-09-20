import type { Periodicidade } from "@/generated/prisma/client";

const MESES_POR_PERIODICIDADE: Record<Periodicidade, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/** Início do dia (00:00 UTC) na mesma data-calendário — mesma convenção de `financeiro-ledger.ts#inicioDoDia`. */
function inicioDoDiaUTC(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
}

function montarData(ano: number, mes: number, diaDesejado: number): Date {
  const anoNormalizado = ano + Math.floor(mes / 12);
  const mesNormalizado = ((mes % 12) + 12) % 12;
  const dia = Math.min(diaDesejado, ultimoDiaDoMes(anoNormalizado, mesNormalizado));
  return new Date(Date.UTC(anoNormalizado, mesNormalizado, dia));
}

/**
 * Próxima ocorrência de um Lançamento Recorrente: `última gerada + N meses`
 * (N conforme periodicidade, `diaVencimento` ajustado pro último dia real do
 * mês quando ele não existir, ex. dia 31 em fevereiro), ou a primeira
 * ocorrência a partir de `dataInicio` quando nunca gerado ainda. Retorna
 * `null` quando `dataFim` já passou dessa ocorrência — não há mais nada a
 * gerar. Pura, sem tocar no banco.
 */
export function calcularProximaOcorrenciaRecorrente(
  recorrente: { periodicidade: Periodicidade; diaVencimento: number; dataInicio: Date; dataFim: Date | null },
  ultimaGerada: Date | null
): Date | null {
  const passo = MESES_POR_PERIODICIDADE[recorrente.periodicidade];
  let proxima: Date;

  if (ultimaGerada) {
    const base = inicioDoDiaUTC(ultimaGerada);
    proxima = montarData(base.getUTCFullYear(), base.getUTCMonth() + passo, recorrente.diaVencimento);
  } else {
    const inicio = inicioDoDiaUTC(recorrente.dataInicio);
    proxima = montarData(inicio.getUTCFullYear(), inicio.getUTCMonth(), recorrente.diaVencimento);
    // Se o dia de vencimento do próprio mês de início já passou, a primeira
    // ocorrência de verdade é no período seguinte — nunca gera retroativo a
    // uma data anterior à dataInicio configurada.
    if (proxima.getTime() < inicio.getTime()) {
      proxima = montarData(inicio.getUTCFullYear(), inicio.getUTCMonth() + passo, recorrente.diaVencimento);
    }
  }

  if (recorrente.dataFim && proxima.getTime() > inicioDoDiaUTC(recorrente.dataFim).getTime()) {
    return null;
  }
  return proxima;
}
