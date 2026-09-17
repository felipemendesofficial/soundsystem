import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { darBaixaLancamento } from "../../actions";
import { BaixaForm } from "./baixa-form";

export default async function BaixaLancamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const lancamento = await db.lancamentoFinanceiro.findFirst({ where: { id, empresaId } });
  if (!lancamento) notFound();
  if (lancamento.status !== "aberto") redirect(`/lancamentos-financeiros/${id}`);

  const contas = await db.contaFinanceira.findMany({ where: { empresaId, ativo: true }, orderBy: { nome: "asc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dar Baixa</h1>
      <p className="text-sm text-muted-foreground">{lancamento.historicoSimplificado}</p>
      <BaixaForm
        action={darBaixaLancamento.bind(null, id)}
        cancelarHref={`/lancamentos-financeiros/${id}`}
        contas={contas.map((c) => ({ id: c.id, label: c.nome }))}
        contaPrevistaId={lancamento.contaPrevistaId}
        valorOriginal={Number(lancamento.valorOriginal)}
        dataVencimento={lancamento.dataVencimento.toISOString().slice(0, 10)}
        moraMes={lancamento.moraMes ? Number(lancamento.moraMes) : null}
      />
    </div>
  );
}
