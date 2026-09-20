import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { RenegociacoesLista } from "@/components/renegociacoes-lista";

export default async function RenegociacoesPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const renegociacoes = await db.renegociacao.findMany({
    where: { empresaId },
    include: { origens: true, destinos: true },
    orderBy: { criadoEm: "desc" },
  });

  const itens = renegociacoes.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    motivo: r.motivo,
    status: r.status,
    origens: r.origens.length,
    destinos: r.destinos.length,
    criadoEmLabel: r.criadoEm.toLocaleDateString("pt-BR"),
    criadoEmISO: r.criadoEm.toISOString().slice(0, 10),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Renegociações</h1>
        <Button render={<Link href="/renegociacoes/novo" />}>Nova</Button>
      </div>

      <RenegociacoesLista itens={itens} />
    </div>
  );
}
