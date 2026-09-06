import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { atualizarCategoria } from "../actions";
import { CategoriaForm } from "../categoria-form";

export default async function EditarCategoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const categoria = await db.categoria.findUnique({ where: { id } });
  if (!categoria) notFound();

  const action = atualizarCategoria.bind(null, id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar Categoria</h1>
      <CategoriaForm action={action} defaultValues={categoria} />
    </div>
  );
}
