import { Prisma } from "@/generated/prisma/client";

export type ItemRateio = {
  produtoId: string;
  quantidade: Prisma.Decimal;
  valorEstimadoVenda: Prisma.Decimal;
};

export type ItemRateado = ItemRateio & {
  fator: Prisma.Decimal;
  custoCompraUnitario: Prisma.Decimal;
  custoCompraTotal: Prisma.Decimal;
};

export type ResultadoRateio = {
  valorVendaTotal: Prisma.Decimal;
  valorCompraTotal: Prisma.Decimal;
  taxaRevendaEfetiva: Prisma.Decimal;
  itens: ItemRateado[];
};

/**
 * Rateia o valor de compra de um Orçamento entre seus itens, reproduzindo a
 * lógica da planilha original de rateio: cada item recebe uma fatia do
 * valor total de compra proporcional ao seu próprio valor estimado de venda
 * (fator = valorVenda_item / valorVendaTotal; custoCompra_item = fator *
 * valorCompraTotal). O valor total de compra vem de uma taxa de revenda
 * (desconto % sobre o total estimado de venda) ou de um valor total
 * informado diretamente — o chamador passa exatamente um dos dois.
 */
export function calcularRateio(
  itens: ItemRateio[],
  opts: { taxaRevenda?: Prisma.Decimal | null; valorCompraTotalInformado?: Prisma.Decimal | null }
): ResultadoRateio {
  const zero = new Prisma.Decimal(0);

  const valorVendaTotal = itens.reduce(
    (acc, item) => acc.plus(item.valorEstimadoVenda.times(item.quantidade)),
    zero
  );

  const valorCompraTotal =
    opts.valorCompraTotalInformado != null
      ? opts.valorCompraTotalInformado
      : valorVendaTotal.times(new Prisma.Decimal(1).minus((opts.taxaRevenda ?? zero).dividedBy(100)));

  const taxaRevendaEfetiva = valorVendaTotal.isZero()
    ? zero
    : new Prisma.Decimal(1).minus(valorCompraTotal.dividedBy(valorVendaTotal)).times(100);

  const itensRateados: ItemRateado[] = itens.map((item) => {
    const valorLinha = item.valorEstimadoVenda.times(item.quantidade);
    const fator = valorVendaTotal.isZero() ? zero : valorLinha.dividedBy(valorVendaTotal);
    const custoCompraTotal = fator.times(valorCompraTotal);
    const custoCompraUnitario = item.quantidade.isZero() ? zero : custoCompraTotal.dividedBy(item.quantidade);
    return { ...item, fator, custoCompraUnitario, custoCompraTotal };
  });

  return { valorVendaTotal, valorCompraTotal, taxaRevendaEfetiva, itens: itensRateados };
}
