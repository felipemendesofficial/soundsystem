import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { atualizarProcesso } from "../../actions";
import { ProcessoForm } from "../../processo-form";

export default async function EditarProcessoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const processo = await db.processo.findFirst({
    where: { id, empresaId: session.user.empresaId! },
    include: { mascara: true },
  });
  if (!processo) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar Processo</h1>
      <ProcessoForm
        action={atualizarProcesso.bind(null, id)}
        cancelarHref={`/processos/${id}`}
        defaultValues={{
          nome: processo.nome,
          dataInicio: processo.dataInicio.toISOString().slice(0, 10),
          dataFim: processo.dataFim.toISOString().slice(0, 10),
          padrao: processo.padrao,
          mascaraNome: processo.mascara.nome,
        }}
      />
    </div>
  );
}
