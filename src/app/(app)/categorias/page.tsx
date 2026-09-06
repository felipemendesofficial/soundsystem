import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";

export default async function CategoriasPage() {
  const categorias = await db.categoria.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categorias</h1>
        <Button render={<Link href="/categorias/novo" />}>Nova Categoria</Button>
      </div>

      <DataTable
        rows={categorias}
        getKey={(c) => c.id}
        emptyMessage="Nenhuma categoria cadastrada."
        columns={[
          { header: "Nome", cell: (c) => c.nome },
          {
            header: "Status",
            cell: (c) => (
              <Badge variant={c.ativo ? "default" : "secondary"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
            ),
          },
          {
            header: "",
            cell: (c) => (
              <Link href={`/categorias/${c.id}`} className="text-sm underline underline-offset-2">
                Editar
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
