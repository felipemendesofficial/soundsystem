import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { TabelasPrecoLista, type ItemTabelaPrecoLista } from "@/components/tabelas-preco-lista";

export default async function TabelaPrecosPage() {
  const tabelas = await db.tabelaPreco.findMany({
    include: { _count: { select: { itens: true } } },
    orderBy: { nome: "asc" },
  });

  const itensLista: ItemTabelaPrecoLista[] = tabelas.map((t) => ({
    id: t.id,
    nome: t.nome,
    ativo: t.ativo,
    quantidadeItens: t._count.itens,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tabelas de Preço</h1>
        <Button render={<Link href="/tabela-precos/novo" />}>Nova Tabela</Button>
      </div>

      <TabelasPrecoLista itens={itensLista} />
    </div>
  );
}
