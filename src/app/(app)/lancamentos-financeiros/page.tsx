import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { LancamentosFinanceirosLista, type ItemLancamentoFinanceiro } from "@/components/lancamentos-financeiros-lista";
import { TIPOS_DOCUMENTO_LABEL } from "@/lib/financeiro-labels";

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
    include: {
      cliente: { select: { nome: true } },
      fornecedor: { select: { nome: true } },
      processo: { select: { nome: true } },
      rateios: {
        include: {
          plano: { select: { codigo: true, descricao: true } },
          rateiosCentroCusto: { include: { centroCusto: { select: { codigo: true, descricao: true } } } },
        },
      },
    },
  });

  const itens: ItemLancamentoFinanceiro[] = lancamentos.map((l) => {
    const contraParte = l.fornecedor?.nome ?? l.cliente?.nome ?? "";
    const planos = l.rateios.map((r) => `${r.plano.codigo} ${r.plano.descricao}`);
    const centrosCusto = l.rateios.flatMap((r) =>
      r.rateiosCentroCusto.map((cc) => `${cc.centroCusto.codigo} ${cc.centroCusto.descricao}`)
    );
    const buscaTexto = [
      l.historicoSimplificado,
      l.historicoComplementar,
      l.observacao,
      l.documento,
      contraParte,
      l.processo.nome,
      ...planos,
      ...centrosCusto,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return {
      id: l.id,
      historico: l.historicoSimplificado,
      tipo: l.tipo,
      status: l.status,
      valor: formatarMoeda(l.valorOriginal),
      valorNumerico: Number(l.valorOriginal),
      tipoDocumento: TIPOS_DOCUMENTO_LABEL[l.tipoDocumento] ?? l.tipoDocumento,
      vencimento: formatarData(l.dataVencimento),
      vencimentoISO: l.dataVencimento.toISOString().slice(0, 10),
      buscaTexto,
    };
  });

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
