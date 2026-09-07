import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { CategoriasLista } from "@/components/categorias-lista";

export default async function CategoriasPage() {
  const categorias = await db.categoria.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categorias</h1>
        <Button render={<Link href="/categorias/novo" />}>Nova Categoria</Button>
      </div>

      <CategoriasLista itens={categorias.map((c) => ({ id: c.id, nome: c.nome, ativo: c.ativo }))} />
    </div>
  );
}
