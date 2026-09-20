import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { BandeirasLista, type ItemBandeira } from "@/components/bandeiras-lista";

// Sem filtro de empresaId/grupoId de propósito: Bandeira é catálogo global
// (nomes padronizados no mercado), compartilhado por todos os grupos —
// mesmo raciocínio de AlineaDevolucaoCheque.
export default async function AdminBandeirasPage() {
  const bandeiras = await db.bandeira.findMany({ orderBy: { nome: "asc" } });

  const itensLista: ItemBandeira[] = bandeiras.map((b) => ({
    id: b.id,
    nome: b.nome,
    ativo: b.ativo,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bandeiras de Cartão</h1>
        <Button render={<Link href="/admin/bandeiras/novo" />}>Nova Bandeira</Button>
      </div>

      <BandeirasLista itens={itensLista} />
    </div>
  );
}
