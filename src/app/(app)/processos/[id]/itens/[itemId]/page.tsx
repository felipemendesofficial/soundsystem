import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { atualizarProcessoItem, alternarAtivoProcessoItem } from "../../../actions";
import { ProcessoItemForm } from "../processo-item-form";

export default async function EditarProcessoItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id: processoId, itemId } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const processo = await db.processo.findFirst({ where: { id: processoId, empresaId: session.user.empresaId! } });
  if (!processo) notFound();

  const item = await db.processoItem.findFirst({ where: { id: itemId, processoId } });
  if (!item) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Editar Item</h1>
        <Badge variant={item.ativo ? "default" : "secondary"}>{item.ativo ? "Ativo" : "Inativo"}</Badge>
      </div>

      <ProcessoItemForm
        action={atualizarProcessoItem.bind(null, processoId, itemId)}
        cancelarHref={`/processos/${processoId}`}
        defaultValues={{ codigo: item.codigo, descricao: item.descricao, natureza: item.natureza }}
      />

      <form action={alternarAtivoProcessoItem.bind(null, processoId, itemId, !item.ativo)}>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className={item.ativo ? "border-destructive text-destructive hover:bg-destructive/10" : ""}
        >
          {item.ativo ? "Desativar" : "Ativar"}
        </Button>
      </form>
    </div>
  );
}
