import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { atualizarBandeira, alternarAtivoBandeira } from "../actions";
import { BandeiraForm } from "../bandeira-form";

export default async function EditarBandeiraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bandeira = await db.bandeira.findUnique({ where: { id } });
  if (!bandeira) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Editar Bandeira</h1>
        <Badge variant={bandeira.ativo ? "default" : "secondary"}>
          {bandeira.ativo ? "Ativa" : "Inativa"}
        </Badge>
      </div>

      <BandeiraForm action={atualizarBandeira.bind(null, id)} defaultValues={{ nome: bandeira.nome }} />

      <form action={alternarAtivoBandeira.bind(null, id, !bandeira.ativo)}>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className={bandeira.ativo ? "border-destructive text-destructive hover:bg-destructive/10" : ""}
        >
          {bandeira.ativo ? "Desativar" : "Ativar"}
        </Button>
      </form>
    </div>
  );
}
