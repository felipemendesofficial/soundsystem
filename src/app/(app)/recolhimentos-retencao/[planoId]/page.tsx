import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { gerarRecolhimentoRetencao } from "../actions";
import { RecolhimentoForm } from "./recolhimento-form";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function RecolhimentoPlanoPage({ params }: { params: Promise<{ planoId: string }> }) {
  const { planoId } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;
  const grupoId = session.user.grupoId!;

  const plano = await db.planoFinanceiro.findFirst({ where: { id: planoId, grupoId } });
  if (!plano) notFound();

  const retencoes = await db.retencao.findMany({
    where: { planoId, status: "pendente", lancamento: { empresaId, status: "baixado" } },
  });
  if (retencoes.length === 0) redirect("/recolhimentos-retencao");
  const total = retencoes.reduce((acc, r) => acc + Number(r.valor), 0);

  const [processos, processoItens] = await Promise.all([
    db.processo.findMany({ where: { empresaId, ativo: true }, orderBy: { nome: "asc" } }),
    db.processoItem.findMany({
      where: { processo: { empresaId }, natureza: "analitica", ativo: true },
      orderBy: { codigo: "asc" },
    }),
  ]);
  const processoPadrao = processos.find((p) => p.padrao) ?? (processos.length === 1 ? processos[0] : undefined);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Recolher {plano.codigo} — {plano.descricao}</h1>
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 text-sm">
        <span className="text-muted-foreground">{retencoes.length} retenção(ões) pendente(s)</span>
        <span className="text-base font-semibold">{formatarMoeda(total)}</span>
      </div>

      <RecolhimentoForm
        action={gerarRecolhimentoRetencao.bind(null, planoId)}
        cancelarHref="/recolhimentos-retencao"
        processos={processos.map((p) => ({ id: p.id, label: p.nome }))}
        processoItens={processoItens.map((i) => ({ id: i.id, label: `${i.codigo} — ${i.descricao}`, processoId: i.processoId }))}
        processoPadraoId={processoPadrao?.id}
      />
    </div>
  );
}
