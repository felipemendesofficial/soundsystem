import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { atualizarCliente } from "../actions";
import { ClienteForm } from "../cliente-form";

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [cliente, tabelasPreco] = await Promise.all([
    db.cliente.findUnique({ where: { id } }),
    db.tabelaPreco.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
  ]);
  if (!cliente) notFound();

  const action = atualizarCliente.bind(null, id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar Cliente</h1>
      <ClienteForm
        action={action}
        tabelasPreco={tabelasPreco.map((t) => ({ id: t.id, nome: t.nome }))}
        defaultValues={cliente}
      />
    </div>
  );
}
