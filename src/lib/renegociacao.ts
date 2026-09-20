import { Prisma } from "@/generated/prisma/client";
import { distribuirValor } from "@/lib/rateio-financeiro";

type LinhaOrigem = {
  planoId: string;
  valor: Prisma.Decimal;
  rateiosCentroCusto: { centroCustoId: string; valor: Prisma.Decimal }[];
};

export type ComboRateio = { planoId: string; centroCustoId: string | null; valor: Prisma.Decimal };

/**
 * Consolida o rateio de TODOS os títulos de origem por combinação
 * (planoId, centroCustoId), somando `valor` de cada combinação através de
 * todas as origens — passo 1 da herança de rateio da Renegociação. Uma linha
 * de Plano sem Centro de Custo entra como `(planoId, null)`.
 */
export function consolidarRateioOrigens(origensRateios: LinhaOrigem[][]): ComboRateio[] {
  const mapa = new Map<string, ComboRateio>();

  for (const rateiosDeUmaOrigem of origensRateios) {
    for (const linha of rateiosDeUmaOrigem) {
      if (linha.rateiosCentroCusto.length > 0) {
        for (const cc of linha.rateiosCentroCusto) {
          const chave = `${linha.planoId}|${cc.centroCustoId}`;
          const atual = mapa.get(chave);
          mapa.set(chave, { planoId: linha.planoId, centroCustoId: cc.centroCustoId, valor: (atual?.valor ?? new Prisma.Decimal(0)).plus(cc.valor) });
        }
      } else {
        const chave = `${linha.planoId}|`;
        const atual = mapa.get(chave);
        mapa.set(chave, { planoId: linha.planoId, centroCustoId: null, valor: (atual?.valor ?? new Prisma.Decimal(0)).plus(linha.valor) });
      }
    }
  }

  return Array.from(mapa.values());
}

export type LinhaRateioHerdado = { planoId: string; centroCustoId: string | null; percentual: Prisma.Decimal; valor: Prisma.Decimal };

/**
 * Aplica o rateio consolidado das origens (passo 1) sobre UM título de
 * destino específico — passos 2-4 da herança: cada combinação vira um
 * percentual sobre `totalOrigem`, aplicado (via `distribuirValor`, que já
 * cuida do resíduo de arredondamento) sobre o `valorDestino` daquele título.
 * Resultado editável depois pela tela normal de edição de Lançamento.
 */
export function calcularRateioHerdado(
  consolidado: ComboRateio[],
  totalOrigem: Prisma.Decimal,
  valorDestino: Prisma.Decimal
): LinhaRateioHerdado[] {
  if (totalOrigem.isZero()) return [];

  const linhasComPercentual = consolidado.map((c) => ({
    planoId: c.planoId,
    centroCustoId: c.centroCustoId,
    percentual: c.valor.dividedBy(totalOrigem).times(100),
  }));

  return distribuirValor(valorDestino, linhasComPercentual);
}
