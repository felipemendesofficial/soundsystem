import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ProdutosLista, type ItemProduto } from "@/components/produtos-lista";

export default async function ProdutosPage() {
  const session = await auth();
  const produtos = await db.produto.findMany({
    where: { grupoId: session!.user.grupoId! },
    include: { categoria: true },
    orderBy: { nome: "asc" },
  });

  const itensLista: ItemProduto[] = produtos.map((p) => {
    const marcaModelo = [p.marca, p.modelo].filter(Boolean).join(" / ") || "-";
    return {
      id: p.id,
      sku: p.sku,
      nome: p.nome,
      categoria: p.categoria.nome,
      marcaModelo,
      controlaEstoque: p.controlaEstoque,
      buscaTexto: [p.sku, p.nome, p.categoria.nome, p.marca, p.modelo]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Produtos</h1>
        <Button render={<Link href="/produtos/novo" />}>Novo Produto</Button>
      </div>

      <ProdutosLista itens={itensLista} />
    </div>
  );
}
