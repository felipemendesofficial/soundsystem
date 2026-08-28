import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";

const ESTADO_LABEL: Record<string, string> = {
  excelente: "Excelente",
  bom: "Bom",
  regular: "Regular",
  para_reparo: "Para reparo",
};

export default async function ProdutosPage() {
  const produtos = await db.produto.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Produtos</h1>
        <Button render={<Link href="/produtos/novo" />}>Novo Produto</Button>
      </div>

      <DataTable
        rows={produtos}
        getKey={(p) => p.id}
        columns={[
          { header: "SKU", cell: (p) => p.sku },
          { header: "Nome", cell: (p) => p.nome },
          { header: "Categoria", cell: (p) => p.categoria },
          { header: "Marca/Modelo", cell: (p) => [p.marca, p.modelo].filter(Boolean).join(" / ") || "-" },
          {
            header: "Estado",
            cell: (p) => <Badge variant="secondary">{ESTADO_LABEL[p.estadoConservacao]}</Badge>,
          },
          {
            header: "",
            cell: (p) => (
              <div className="flex gap-3">
                <Link href={`/kardex/${p.id}`} className="text-sm underline underline-offset-2">
                  Kardex
                </Link>
                <Link href={`/produtos/${p.id}`} className="text-sm underline underline-offset-2">
                  Editar
                </Link>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
