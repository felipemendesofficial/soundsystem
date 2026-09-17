import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { atualizarCentroCusto, alternarAtivoCentroCusto } from "../actions";
import { CentroCustoForm } from "../centro-custo-form";

export default async function EditarCentroCustoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const centro = await db.centroCusto.findFirst({ where: { id, grupoId: session.user.grupoId! } });
  if (!centro) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Editar Centro de Custo</h1>
        <Badge variant={centro.ativo ? "default" : "secondary"}>{centro.ativo ? "Ativo" : "Inativo"}</Badge>
      </div>

      <CentroCustoForm
        action={atualizarCentroCusto.bind(null, id)}
        cancelarHref={`/centros-custo?mascaraId=${centro.mascaraId}`}
        defaultValues={{ codigo: centro.codigo, descricao: centro.descricao, natureza: centro.natureza }}
      />

      <form action={alternarAtivoCentroCusto.bind(null, id, !centro.ativo)}>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className={centro.ativo ? "border-destructive text-destructive hover:bg-destructive/10" : ""}
        >
          {centro.ativo ? "Desativar" : "Ativar"}
        </Button>
      </form>
    </div>
  );
}
