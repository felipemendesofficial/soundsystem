import { db } from "@/lib/db";
import { criarProduto } from "../actions";
import { ProdutoForm } from "../produto-form";

export default async function NovoProdutoPage() {
  const [categorias, unidadesMedida] = await Promise.all([
    db.categoria.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    db.unidadeMedida.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo Produto</h1>
      <ProdutoForm action={criarProduto} categorias={categorias} unidadesMedida={unidadesMedida} />
    </div>
  );
}
