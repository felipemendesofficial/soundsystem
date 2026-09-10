import { db } from "@/lib/db";
import { obterCustoMedioCombinadoPorProduto } from "@/lib/tabela-preco";
import { criarTabelaPreco } from "../actions";
import { TabelaPrecoForm, type ProdutoPreco } from "@/components/tabela-preco-form";

export default async function NovaTabelaPrecoPage() {
  const [produtos, custosMedios] = await Promise.all([
    db.produto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    obterCustoMedioCombinadoPorProduto(),
  ]);

  const produtosPreco: ProdutoPreco[] = produtos.map((p) => ({
    id: p.id,
    sku: p.sku,
    nome: p.nome,
    custoMedio: custosMedios.get(p.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Tabela de Preço</h1>
      <TabelaPrecoForm action={criarTabelaPreco} produtos={produtosPreco} />
    </div>
  );
}
