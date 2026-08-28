import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";

export default async function ClientesPage() {
  const clientes = await db.cliente.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <Button render={<Link href="/clientes/novo" />}>Novo Cliente</Button>
      </div>

      <DataTable
        rows={clientes}
        getKey={(c) => c.id}
        columns={[
          { header: "Nome", cell: (c) => c.nome },
          { header: "Tipo", cell: (c) => (c.tipoCliente === "varejista" ? "Varejista" : "Atacadista") },
          { header: "Telefone", cell: (c) => c.telefone ?? "-" },
          { header: "Email", cell: (c) => c.email ?? "-" },
          {
            header: "",
            cell: (c) => (
              <Link href={`/clientes/${c.id}`} className="text-sm underline underline-offset-2">
                Editar
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
