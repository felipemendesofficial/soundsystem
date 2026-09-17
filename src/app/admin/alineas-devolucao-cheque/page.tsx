import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { AlineasLista, type ItemAlinea } from "@/components/alineas-lista";

// Sem filtro de empresaId/grupoId de propósito: AlineaDevolucaoCheque é
// tabela de referência global (códigos oficiais Bacen), compartilhada por
// todos os grupos — mesmo raciocínio de "visão cross-grupo restrita ao
// master" já documentado em admin/grupos/page.tsx.
export default async function AdminAlineasPage() {
  const alineas = await db.alineaDevolucaoCheque.findMany({ orderBy: { codigo: "asc" } });

  const itensLista: ItemAlinea[] = alineas.map((a) => ({
    id: a.id,
    codigo: a.codigo,
    descricao: a.descricao,
    ativo: a.ativo,
    buscaTexto: [a.codigo, a.descricao].join(" ").toLowerCase(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Alíneas de Devolução de Cheque</h1>
        <Button render={<Link href="/admin/alineas-devolucao-cheque/novo" />}>Nova Alínea</Button>
      </div>

      <AlineasLista itens={itensLista} />
    </div>
  );
}
