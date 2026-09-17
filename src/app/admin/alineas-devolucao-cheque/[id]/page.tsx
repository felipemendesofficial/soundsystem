import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { atualizarAlinea, alternarAtivoAlinea } from "../actions";
import { AlineaForm } from "../alinea-form";

export default async function EditarAlineaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const alinea = await db.alineaDevolucaoCheque.findUnique({ where: { id } });
  if (!alinea) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Editar Alínea</h1>
        <Badge variant={alinea.ativo ? "default" : "secondary"}>
          {alinea.ativo ? "Ativa" : "Inativa"}
        </Badge>
      </div>

      <AlineaForm
        action={atualizarAlinea.bind(null, id)}
        defaultValues={{ codigo: alinea.codigo, descricao: alinea.descricao }}
      />

      <form action={alternarAtivoAlinea.bind(null, id, !alinea.ativo)}>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className={alinea.ativo ? "border-destructive text-destructive hover:bg-destructive/10" : ""}
        >
          {alinea.ativo ? "Desativar" : "Ativar"}
        </Button>
      </form>
    </div>
  );
}
