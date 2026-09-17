import { Prisma } from "@/generated/prisma/client";

const TOLERANCIA_PERCENTUAL = new Prisma.Decimal("0.01");

/**
 * Confirma que os percentuais de um grupo de rateio (Plano Financeiro, Centro
 * de Custo aninhado, ou Processo) somam exatamente o alvo (100% por padrão),
 * com uma tolerância de 0.01 pra imprecisão de ponto flutuante vinda do
 * client. Lança em vez de retornar bool — quem chama decide a mensagem
 * (identifica qual grupo de rateio falhou).
 */
export function validarSomaPercentual(linhas: { percentual: Prisma.Decimal }[], alvo: Prisma.Decimal | number = 100) {
  const alvoDecimal = alvo instanceof Prisma.Decimal ? alvo : new Prisma.Decimal(alvo);
  const soma = linhas.reduce((acc, l) => acc.plus(l.percentual), new Prisma.Decimal(0));
  if (soma.minus(alvoDecimal).abs().greaterThan(TOLERANCIA_PERCENTUAL)) {
    throw new Error(`Os percentuais devem somar 100% (somaram ${soma.toFixed(2)}%).`);
  }
}

/**
 * Distribui `base` entre as linhas conforme seus percentuais. A última linha
 * absorve o resíduo de arredondamento (`valor = base − soma das anteriores`)
 * em vez de simplesmente `base × percentual/100` em todas — garante que a
 * soma dos `valor` das linhas bate exatamente com `base`, como as tabelas
 * `LancamentoRateio*` exigem ("soma 100% do..."). `src/lib/orcamento.ts#calcularRateio`
 * não faz essa correção (ali é só uma prévia de custo, não uma soma que
 * precisa fechar exata), por isso não é reaproveitado aqui.
 */
export function distribuirValor<T extends { percentual: Prisma.Decimal }>(
  base: Prisma.Decimal,
  linhas: T[]
): (T & { valor: Prisma.Decimal })[] {
  const resultado: (T & { valor: Prisma.Decimal })[] = [];
  let acumulado = new Prisma.Decimal(0);

  linhas.forEach((linha, index) => {
    const ultima = index === linhas.length - 1;
    const valor = ultima
      ? base.minus(acumulado)
      : base.times(linha.percentual).dividedBy(100).toDecimalPlaces(2);
    acumulado = acumulado.plus(valor);
    resultado.push({ ...linha, valor });
  });

  return resultado;
}
