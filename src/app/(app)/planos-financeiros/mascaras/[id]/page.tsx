import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MascaraForm } from "@/components/mascara-form";
import { atualizarMascaraPlanoFinanceiro, alternarAtivoMascaraPlanoFinanceiro } from "../actions";

export default async function EditarMascaraPlanoFinanceiroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const mascara = await db.mascaraPlanoFinanceiro.findFirst({
    where: { id, grupoId: session.user.grupoId! },
    include: { segmentos: { orderBy: { ordem: "asc" } }, _count: { select: { planos: true } } },
  });
  if (!mascara) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Editar Máscara</h1>
        <Badge variant={mascara.ativo ? "default" : "secondary"}>{mascara.ativo ? "Ativa" : "Inativa"}</Badge>
      </div>

      <MascaraForm
        action={atualizarMascaraPlanoFinanceiro.bind(null, id)}
        cancelarHref="/planos-financeiros/mascaras"
        segmentosEditaveis={mascara._count.planos === 0}
        defaultValues={{ nome: mascara.nome, segmentos: mascara.segmentos }}
      />

      <form action={alternarAtivoMascaraPlanoFinanceiro.bind(null, id, !mascara.ativo)}>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className={mascara.ativo ? "border-destructive text-destructive hover:bg-destructive/10" : ""}
        >
          {mascara.ativo ? "Desativar" : "Ativar"}
        </Button>
      </form>
    </div>
  );
}
