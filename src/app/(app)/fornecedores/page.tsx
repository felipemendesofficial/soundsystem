import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";

export default async function FornecedoresPage() {
  const fornecedores = await db.fornecedor.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fornecedores</h1>
        <Button render={<Link href="/fornecedores/novo" />}>Novo Fornecedor</Button>
      </div>

      <DataTable
        rows={fornecedores}
        getKey={(f) => f.id}
        columns={[
          { header: "Nome", cell: (f) => f.nome },
          { header: "Tipo", cell: (f) => (f.tipoPessoa === "fisica" ? "Física" : "Jurídica") },
          { header: "Telefone", cell: (f) => f.telefone ?? "-" },
          { header: "Email", cell: (f) => f.email ?? "-" },
          {
            header: "",
            cell: (f) => (
              <Link href={`/fornecedores/${f.id}`} className="text-sm underline underline-offset-2">
                Editar
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
