import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { VendedoresLista, type ItemVendedor } from "@/components/vendedores-lista";

function formatarComissao(vendedor: { recebeComissao: boolean; tipoComissao: string | null; valorComissao: unknown }) {
  if (!vendedor.recebeComissao || vendedor.valorComissao === null) return "-";
  return vendedor.tipoComissao === "percentual"
    ? `${Number(vendedor.valorComissao).toLocaleString("pt-BR")}%`
    : Number(vendedor.valorComissao).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function VendedoresPage() {
  const vendedores = await db.vendedor.findMany({ orderBy: { nome: "asc" } });

  const itensLista: ItemVendedor[] = vendedores.map((v) => ({
    id: v.id,
    nome: v.nome,
    ativo: v.ativo,
    comissao: formatarComissao(v),
    buscaTexto: v.nome.toLowerCase(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vendedores</h1>
        <Button render={<Link href="/vendedores/novo" />}>Novo Vendedor</Button>
      </div>

      <VendedoresLista itens={itensLista} />
    </div>
  );
}
