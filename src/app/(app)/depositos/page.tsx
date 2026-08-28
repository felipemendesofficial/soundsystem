import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";

export default async function DepositosPage() {
  const depositos = await db.deposito.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Depósitos</h1>
        <Button render={<Link href="/depositos/novo" />}>Novo Depósito</Button>
      </div>

      <DataTable
        rows={depositos}
        getKey={(d) => d.id}
        columns={[
          { header: "Nome", cell: (d) => d.nome },
          { header: "Endereço", cell: (d) => d.endereco ?? "-" },
          {
            header: "Status",
            cell: (d) => (
              <Badge variant={d.ativo ? "default" : "secondary"}>{d.ativo ? "Ativo" : "Inativo"}</Badge>
            ),
          },
          {
            header: "",
            cell: (d) => (
              <Link href={`/depositos/${d.id}`} className="text-sm underline underline-offset-2">
                Editar
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
