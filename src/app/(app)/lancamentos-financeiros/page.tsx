import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { LancamentosFinanceirosLista, type ItemLancamentoFinanceiro } from "@/components/lancamentos-financeiros-lista";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function LancamentosFinanceirosPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const lancamentos = await db.lancamentoFinanceiro.findMany({
    where: { empresaId: session.user.empresaId! },
    orderBy: { dataVencimento: "desc" },
  });

  const itens: ItemLancamentoFinanceiro[] = lancamentos.map((l) => ({
    id: l.id,
    historico: l.historicoSimplificado,
    tipo: l.tipo,
    status: l.status,
    valor: formatarMoeda(l.valorOriginal),
    vencimento: formatarData(l.dataVencimento),
    buscaTexto: l.historicoSimplificado.toLowerCase(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lançamentos Financeiros</h1>
        <Button render={<Link href="/lancamentos-financeiros/novo" />}>Novo</Button>
      </div>

      <LancamentosFinanceirosLista itens={itens} />
    </div>
  );
}
