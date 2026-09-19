import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { estornarBaixaLancamento } from "../../actions";
import { EstornoForm } from "./estorno-form";

export default async function EstornoBaixaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const lancamento = await db.lancamentoFinanceiro.findFirst({ where: { id, empresaId } });
  if (!lancamento) notFound();

  const baixaAtiva = await db.baixa.findFirst({ where: { lancamentoId: id, estornada: false } });
  if (!baixaAtiva) redirect(`/lancamentos-financeiros/${id}`);

  const ehCheque = lancamento.tipoDocumento.startsWith("cheque_");

  const [contas, alineas] = await Promise.all([
    db.contaFinanceira.findMany({ where: { empresaId, ativo: true }, orderBy: { nome: "asc" } }),
    ehCheque
      ? db.alineaDevolucaoCheque.findMany({ where: { ativo: true }, orderBy: { codigo: "asc" } })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Estornar Baixa</h1>
      <p className="text-sm text-muted-foreground">{lancamento.historicoSimplificado}</p>
      <EstornoForm
        action={estornarBaixaLancamento.bind(null, id)}
        cancelarHref={`/lancamentos-financeiros/${id}`}
        contas={contas.map((c) => ({ id: c.id, label: c.nome }))}
        alineas={alineas.map((a) => ({ id: a.id, label: `${a.codigo} — ${a.descricao}` }))}
        contaOriginalId={baixaAtiva.contaId}
        ehCheque={ehCheque}
      />
    </div>
  );
}
