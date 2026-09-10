import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { obterCustoMedioCombinadoPorProduto } from "@/lib/tabela-preco";
import { atualizarTabelaPreco } from "../actions";
import { TabelaPrecoForm, type ProdutoPreco } from "@/components/tabela-preco-form";

export default async function EditarTabelaPrecoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [tabela, produtos, custosMedios] = await Promise.all([
    db.tabelaPreco.findUnique({ where: { id }, include: { itens: true } }),
    db.produto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    obterCustoMedioCombinadoPorProduto(),
  ]);
  if (!tabela) notFound();

  const produtosPreco: ProdutoPreco[] = produtos.map((p) => ({
    id: p.id,
    sku: p.sku,
    nome: p.nome,
    custoMedio: custosMedios.get(p.id) ?? 0,
  }));

  const precos = Object.fromEntries(tabela.itens.map((i) => [i.produtoId, i.preco.toString()]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar Tabela de Preço</h1>
      <TabelaPrecoForm
        action={atualizarTabelaPreco.bind(null, id)}
        produtos={produtosPreco}
        defaultValues={{ nome: tabela.nome, ativo: tabela.ativo, precos }}
      />
    </div>
  );
}
