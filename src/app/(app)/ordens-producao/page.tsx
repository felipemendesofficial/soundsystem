import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeLancarMovimentacao } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { OrdensProducaoLista, type ItemOrdemProducao } from "@/components/ordens-producao-lista";

export default async function OrdensProducaoPage() {
  const session = await auth();
  if (!session?.user || !podeLancarMovimentacao(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const ordens = await db.ordemProducao.findMany({
    where: { empresaId },
    include: { produtoFinal: true, depositoEntrada: true },
    orderBy: { criadoEm: "desc" },
  });

  const itensLista: ItemOrdemProducao[] = ordens.map((o) => ({
    id: o.id,
    numero: o.numero,
    produtoFinalNome: o.produtoFinal.nome,
    status: o.status,
    quantidadeEntrada: Number(o.quantidadeEntrada),
    depositoEntradaNome: o.depositoEntrada.nome,
    criadoEmLabel: o.criadoEm.toLocaleDateString("pt-BR"),
    criadoEmISO: o.criadoEm.toISOString().slice(0, 10),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ordens de Produção</h1>
        <Button render={<Link href="/ordens-producao/novo" />}>Nova</Button>
      </div>

      <OrdensProducaoLista itens={itensLista} />
    </div>
  );
}
