import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MascaraForm } from "@/components/mascara-form";
import { atualizarMascaraCentroCusto, alternarAtivoMascaraCentroCusto } from "../actions";

export default async function EditarMascaraCentroCustoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const mascara = await db.mascaraCentroCusto.findFirst({
    where: { id, grupoId: session.user.grupoId! },
    include: { segmentos: { orderBy: { ordem: "asc" } }, _count: { select: { centros: true } } },
  });
  if (!mascara) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Editar Máscara</h1>
        <Badge variant={mascara.ativo ? "default" : "secondary"}>{mascara.ativo ? "Ativa" : "Inativa"}</Badge>
      </div>

      <MascaraForm
        action={atualizarMascaraCentroCusto.bind(null, id)}
        cancelarHref="/centros-custo/mascaras"
        segmentosEditaveis={mascara._count.centros === 0}
        defaultValues={{ nome: mascara.nome, segmentos: mascara.segmentos }}
      />

      <form action={alternarAtivoMascaraCentroCusto.bind(null, id, !mascara.ativo)}>
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
