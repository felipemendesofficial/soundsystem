export type ModoAjuste = "nenhum" | "desconto" | "acrescimo";
export type FormatoAjuste = "percentual" | "valor";

export type ItemAjuste = {
  quantidade: number;
  precoDeclarado: number;
};

export type ResultadoAjuste = {
  subtotal: number;
  valorAjuste: number;
  total: number;
  precosFinais: number[];
};

/**
 * Desconto/acréscimo total de uma venda ou OS, redistribuído
 * proporcionalmente entre os itens pelo peso de cada um no subtotal — mesma
 * lógica de rateio de src/lib/orcamento.ts, só que aplicada ao preço de
 * venda em vez de ao custo de compra. Cada item recebe de volta um "preço
 * final" já com o ajuste embutido; é esse valor que vai para o campo de
 * preço existente no envio do formulário — nenhum campo novo no banco.
 */
export function calcularAjusteTotal(
  itens: ItemAjuste[],
  opts: { modo: ModoAjuste; formato: FormatoAjuste; valor: number }
): ResultadoAjuste {
  const subtotal = itens.reduce((acc, i) => acc + i.quantidade * i.precoDeclarado, 0);

  const valorAjuste =
    opts.modo === "nenhum" || opts.valor <= 0
      ? 0
      : opts.formato === "percentual"
        ? subtotal * (opts.valor / 100)
        : opts.valor;

  const sinal = opts.modo === "desconto" ? -1 : opts.modo === "acrescimo" ? 1 : 0;
  const total = Math.max(0, subtotal + sinal * valorAjuste);

  const precosFinais = itens.map((item) => {
    const valorLinha = item.quantidade * item.precoDeclarado;
    const fator = subtotal > 0 ? valorLinha / subtotal : 0;
    const totalLinha = fator * total;
    return item.quantidade > 0 ? totalLinha / item.quantidade : 0;
  });

  return { subtotal, valorAjuste, total, precosFinais };
}
