import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { atualizarProduto } from "../actions";
import { ProdutoForm } from "../produto-form";

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const produto = await db.produto.findUnique({ where: { id } });
  if (!produto) notFound();

  const action = atualizarProduto.bind(null, id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar Produto</h1>
      <ProdutoForm action={action} defaultValues={produto} />
    </div>
  );
}
