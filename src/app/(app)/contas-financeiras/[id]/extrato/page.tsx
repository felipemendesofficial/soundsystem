import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { PeriodoFilter } from "@/components/periodo-filter";
import { primeiroDiaDoMesISO, ultimoDiaDoMesISO, intervaloPeriodo } from "@/lib/periodo";
import { obterResumoConciliacao } from "@/lib/conciliacao";
import { ExtratoContaLista, type ItemExtratoConta } from "@/components/extrato-conta-lista";
import { conciliarMovimentoComData, conciliarMovimentosSelecionados, desconciliarMovimentacao } from "../conciliacao/actions";

const TIPO_LABEL: Record<string, string> = {
  baixa_receita: "Baixa de Receita",
  baixa_despesa: "Baixa de Despesa",
  estorno_baixa: "Estorno de Baixa",
  transferencia_entrada: "Transferência (Entrada)",
  transferencia_saida: "Transferência (Saída)",
  aplicacao_financeira: "Aplicação Financeira",
  resgate_aplicacao: "Resgate de Aplicação",
  rendimento_aplicacao: "Rendimento de Aplicação",
  estorno_movimento_aplicacao: "Estorno de Aplicação",
};

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataHora(data: Date) {
  return data.toLocaleString("pt-BR");
}

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function paraISO(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

export default async function ExtratoContaFinanceiraPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string; dataInicio?: string; dataFim?: string }>;
}) {
  const { id } = await params;
  const { periodo, dataInicio, dataFim } = await searchParams;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const conta = await db.contaFinanceira.findFirst({ where: { id, empresaId } });
  if (!conta) notFound();

  // Retrato do momento atual — independe do filtro De/Até da lista abaixo.
  // Ver src/lib/conciliacao.ts pra fórmula completa (pendência da empresa −
  // pendência do banco, sinais opostos).
  const { totalPendencias, saldoBanco, pendenciasBanco } = await obterResumoConciliacao(id, conta.saldoAtual);

  const hoje = new Date();
  const padraoInicio = primeiroDiaDoMesISO(hoje);
  const padraoFim = ultimoDiaDoMesISO(hoje);
  const filtroPeriodo = periodo === "todos" ? null : intervaloPeriodo(dataInicio ?? padraoInicio, dataFim ?? padraoFim);

  const movimentacoes = await db.movimentacaoFinanceira.findMany({
    where: { contaId: id, ...(filtroPeriodo ? { criadoEm: filtroPeriodo } : {}) },
    orderBy: { criadoEm: "desc" },
  });

  const pendenciasBancoFiltradas = filtroPeriodo
    ? pendenciasBanco.filter((p) => p.data >= filtroPeriodo.gte && p.data < filtroPeriodo.lt)
    : pendenciasBanco;

  const itensLista: ItemExtratoConta[] = movimentacoes.map((m) => ({
    id: m.id,
    tipoLabel: TIPO_LABEL[m.tipo] ?? m.tipo,
    descricao: m.descricao,
    dataISO: paraISO(m.criadoEm),
    dataFormatada: formatarDataHora(m.criadoEm),
    valorFormatado: `${m.valor.greaterThanOrEqualTo(0) ? "+" : "−"} ${formatarMoeda(m.valor.abs())}`,
    positivo: m.valor.greaterThanOrEqualTo(0),
    saldoFormatado: formatarMoeda(m.saldoPosterior),
    conciliado: m.statusConciliacao === "conciliado",
    conciliadoEmFormatado: m.conciliadoEm ? m.conciliadoEm.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Extrato</h1>
        <p className="text-sm text-muted-foreground">{conta.nome}</p>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Saldo do sistema</span>
          <span className="text-base font-semibold">{formatarMoeda(conta.saldoAtual)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total de pendências</span>
          <span className="font-medium">{formatarMoeda(totalPendencias)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-muted-foreground">Saldo do banco</span>
          <span className="text-base font-semibold">{formatarMoeda(saldoBanco)}</span>
        </div>
      </div>

      <PeriodoFilter padraoInicio={padraoInicio} padraoFim={padraoFim} />

      {pendenciasBancoFiltradas.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Pendências do banco — ainda não lançadas pela empresa</h2>
          <ul className="space-y-2">
            {pendenciasBancoFiltradas.map((p) => (
              <li key={p.id} className="space-y-1 rounded-lg border border-dashed border-border bg-card p-3 text-sm">
                <div className="flex justify-between">
                  <span className="truncate pr-2 text-muted-foreground">{p.comentario || (p.tipo === "entrada" ? "Entrada" : "Saída")}</span>
                  <span className={`flex-none font-medium ${p.tipo === "entrada" ? "text-brand-green" : "text-destructive"}`}>
                    {p.tipo === "entrada" ? "+" : "−"} {formatarMoeda(p.valor)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">{formatarData(p.data)}</div>
              </li>
            ))}
          </ul>
          <Link href={`/contas-financeiras/${id}/conciliacao`} className="block text-xs font-medium text-primary">
            Vincular ou resolver na tela de Conciliação →
          </Link>
        </div>
      )}

      {itensLista.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma movimentação registrada {filtroPeriodo ? "no período selecionado." : "para esta conta."}
        </p>
      ) : (
        <ExtratoContaLista
          itens={itensLista}
          conciliarIndividualAction={conciliarMovimentoComData.bind(null, id)}
          conciliarLoteAction={conciliarMovimentosSelecionados.bind(null, id)}
          desconciliarAction={desconciliarMovimentacao.bind(null, id)}
        />
      )}

      <Link href="/contas-financeiras" className="block text-center text-sm font-medium text-primary">
        Voltar para Contas Financeiras
      </Link>
    </div>
  );
}
