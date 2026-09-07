import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { UnidadesMedidaLista } from "@/components/unidades-medida-lista";

export default async function UnidadesMedidaPage() {
  const unidades = await db.unidadeMedida.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Unidades de Medida</h1>
        <Button render={<Link href="/unidades-medida/novo" />}>Nova Unidade</Button>
      </div>

      <UnidadesMedidaLista itens={unidades.map((u) => ({ id: u.id, nome: u.nome, ativo: u.ativo }))} />
    </div>
  );
}
