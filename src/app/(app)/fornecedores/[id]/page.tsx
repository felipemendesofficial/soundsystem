import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { atualizarFornecedor } from "../actions";
import { FornecedorForm } from "../fornecedor-form";

export default async function EditarFornecedorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const fornecedor = await db.fornecedor.findFirst({ where: { id, grupoId: session!.user.grupoId! } });
  if (!fornecedor) notFound();

  const action = atualizarFornecedor.bind(null, id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar Fornecedor</h1>

      <FornecedorForm action={action} defaultValues={fornecedor} />
    </div>
  );
}
