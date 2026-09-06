import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { atualizarUnidadeMedida } from "../actions";
import { UnidadeMedidaForm } from "../unidade-medida-form";

export default async function EditarUnidadeMedidaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unidade = await db.unidadeMedida.findUnique({ where: { id } });
  if (!unidade) notFound();

  const action = atualizarUnidadeMedida.bind(null, id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar Unidade de Medida</h1>
      <UnidadeMedidaForm action={action} defaultValues={unidade} />
    </div>
  );
}
