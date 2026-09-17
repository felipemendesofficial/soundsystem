import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { MascaraForm } from "@/components/mascara-form";
import { atualizarMascaraProcesso } from "../actions";

export default async function EditarMascaraProcessoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const mascara = await db.mascaraProcesso.findFirst({
    where: { id, grupoId: session.user.grupoId! },
    include: { segmentos: { orderBy: { ordem: "asc" } }, _count: { select: { processos: true } } },
  });
  if (!mascara) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar Máscara</h1>

      <MascaraForm
        action={atualizarMascaraProcesso.bind(null, id)}
        cancelarHref="/processos/mascaras"
        segmentosEditaveis={mascara._count.processos === 0}
        defaultValues={{ nome: mascara.nome, segmentos: mascara.segmentos }}
      />
    </div>
  );
}
