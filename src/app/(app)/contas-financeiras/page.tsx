import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ContasFinanceirasLista, type ItemContaFinanceira } from "@/components/contas-financeiras-lista";

const TIPOS: Record<string, string> = {
  conta_corrente: "Conta Corrente",
  caixa: "Caixa",
  fundo_fixo: "Fundo Fixo",
  aplicacao: "Aplicação",
};

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function ContasFinanceirasPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const contas = await db.contaFinanceira.findMany({
    where: { empresaId: session.user.empresaId! },
    orderBy: { nome: "asc" },
  });

  const itensLista: ItemContaFinanceira[] = contas.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipoLabel: TIPOS[c.tipo] ?? c.tipo,
    banco: c.banco ?? "-",
    saldoAtual: formatarMoeda(c.saldoAtual),
    ativo: c.ativo,
    buscaTexto: [c.nome, c.banco, c.numeroConta].filter(Boolean).join(" ").toLowerCase(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contas Financeiras</h1>
        <Button render={<Link href="/contas-financeiras/novo" />}>Nova Conta</Button>
      </div>

      <ContasFinanceirasLista itens={itensLista} />
    </div>
  );
}
