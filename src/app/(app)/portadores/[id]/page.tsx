import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { atualizarPortador, alternarAtivoPortador } from "../actions";
import { PortadorForm } from "../portador-form";

export default async function EditarPortadorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const portador = await db.portador.findFirst({ where: { id, empresaId: session.user.empresaId! } });
  if (!portador) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Editar Portador</h1>
        <Badge variant={portador.ativo ? "default" : "secondary"}>
          {portador.ativo ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      <PortadorForm action={atualizarPortador.bind(null, id)} defaultValues={{ nome: portador.nome }} />

      <form action={alternarAtivoPortador.bind(null, id, !portador.ativo)}>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className={portador.ativo ? "border-destructive text-destructive hover:bg-destructive/10" : ""}
        >
          {portador.ativo ? "Desativar" : "Ativar"}
        </Button>
      </form>
    </div>
  );
}
