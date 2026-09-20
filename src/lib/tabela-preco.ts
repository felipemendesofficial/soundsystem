import { db } from "@/lib/db";

/**
 * Último preço de venda registrado por produto (tipos `venda` e `os_saida`,
 * os únicos que gravam `precoVenda` no Kardex) — usado como sugestão quando
 * o produto não tem preço fixado na tabela de preço selecionada.
 * `DISTINCT ON` é a forma idiomática no Postgres de pegar "a última linha de
 * cada grupo" sem uma subquery de agregação separada.
 */
export async function obterUltimosPrecosVenda(empresaId: string): Promise<Map<string, number>> {
  const linhas = await db.$queryRaw<{ produto_id: string; preco_venda: string }[]>`
    SELECT DISTINCT ON (produto_id) produto_id, preco_venda
    FROM movimentacoes
    WHERE tipo_movimento IN ('venda', 'os_saida') AND preco_venda IS NOT NULL AND empresa_id = ${empresaId}
    ORDER BY produto_id, data_movimento DESC
  `;
  return new Map(linhas.map((l) => [l.produto_id, Number(l.preco_venda)]));
}

/**
 * Preços da Tabela de Preço marcada como `principal` do grupo (só uma por
 * grupo, garantido na aplicação — ver `tabela-precos/actions.ts`) — usado
 * como 2º critério (depois do último preço de venda) pra valorizar o
 * estoque a preço de venda na Home. Devolve mapa vazio se nenhuma tabela
 * estiver marcada como principal.
 */
export async function obterPrecosDaTabelaPrincipal(grupoId: string): Promise<Map<string, number>> {
  const tabela = await db.tabelaPreco.findFirst({
    where: { grupoId, principal: true },
    include: { itens: true },
  });
  if (!tabela) return new Map();
  return new Map(tabela.itens.map((i) => [i.produtoId, Number(i.preco)]));
}

/**
 * Custo médio "combinado" de um produto entre todos os depósitos — só para
 * exibir a margem estimada na tela de gestão de tabela de preços; não é usado
 * em nenhum cálculo de estoque/Kardex.
 */
export async function obterCustoMedioCombinadoPorProduto(empresaId: string): Promise<Map<string, number>> {
  const linhas = await db.$queryRaw<{ produto_id: string; custo_medio: string }[]>`
    SELECT
      produto_id,
      CASE WHEN SUM(quantidade_saldo) > 0
        THEN SUM(valor_total_saldo) / SUM(quantidade_saldo)
        ELSE 0
      END AS custo_medio
    FROM produto_estoque
    WHERE empresa_id = ${empresaId}
    GROUP BY produto_id
  `;
  return new Map(linhas.map((l) => [l.produto_id, Number(l.custo_medio)]));
}
