import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { atualizarServico } from "../actions";
import { ServicoForm } from "../servico-form";

export default async function EditarServicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const servico = await db.servico.findUnique({ where: { id } });
  if (!servico) notFound();

  const action = atualizarServico.bind(null, id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar Serviço</h1>
      <ServicoForm
        action={action}
        defaultValues={{ nome: servico.nome, precoPadrao: servico.precoPadrao.toString() }}
      />
    </div>
  );
}
