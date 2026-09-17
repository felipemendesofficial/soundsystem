import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { atualizarPlanoFinanceiro, alternarAtivoPlanoFinanceiro } from "../actions";
import { PlanoFinanceiroForm } from "../plano-financeiro-form";

export default async function EditarPlanoFinanceiroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const plano = await db.planoFinanceiro.findFirst({ where: { id, grupoId: session.user.grupoId! } });
  if (!plano) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Editar Conta</h1>
        <Badge variant={plano.ativo ? "default" : "secondary"}>{plano.ativo ? "Ativa" : "Inativa"}</Badge>
      </div>

      <PlanoFinanceiroForm
        action={atualizarPlanoFinanceiro.bind(null, id)}
        cancelarHref={`/planos-financeiros?mascaraId=${plano.mascaraId}`}
        defaultValues={{
          codigo: plano.codigo,
          descricao: plano.descricao,
          tipo: plano.tipo,
          natureza: plano.natureza,
        }}
      />

      <form action={alternarAtivoPlanoFinanceiro.bind(null, id, !plano.ativo)}>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className={plano.ativo ? "border-destructive text-destructive hover:bg-destructive/10" : ""}
        >
          {plano.ativo ? "Desativar" : "Ativar"}
        </Button>
      </form>
    </div>
  );
}
