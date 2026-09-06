import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";

export default async function UnidadesMedidaPage() {
  const unidades = await db.unidadeMedida.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Unidades de Medida</h1>
        <Button render={<Link href="/unidades-medida/novo" />}>Nova Unidade</Button>
      </div>

      <DataTable
        rows={unidades}
        getKey={(u) => u.id}
        emptyMessage="Nenhuma unidade de medida cadastrada."
        columns={[
          { header: "Nome", cell: (u) => u.nome },
          {
            header: "Status",
            cell: (u) => (
              <Badge variant={u.ativo ? "default" : "secondary"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
            ),
          },
          {
            header: "",
            cell: (u) => (
              <Link href={`/unidades-medida/${u.id}`} className="text-sm underline underline-offset-2">
                Editar
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
