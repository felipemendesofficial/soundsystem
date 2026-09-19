import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import {
  criarLinhaExtrato,
  conciliarMovimentacao,
  desconciliarMovimentacao,
  criarPendencia,
  resolverPendencia,
} from "./actions";
import { ConciliacaoForms } from "./conciliacao-forms";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function ConciliacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const conta = await db.contaFinanceira.findFirst({ where: { id, empresaId } });
  if (!conta) notFound();

  const [movimentosPendentes, movimentosConciliados, linhasExtrato, pendencias] = await Promise.all([
    db.movimentacaoFinanceira.findMany({
      where: { contaId: id, statusConciliacao: "pendente" },
      orderBy: { criadoEm: "desc" },
      take: 100,
    }),
    db.movimentacaoFinanceira.findMany({
      where: { contaId: id, statusConciliacao: "conciliado" },
      orderBy: { conciliadoEm: "desc" },
      take: 20,
    }),
    db.extratoBancarioLinha.findMany({
      where: { contaId: id, movimentacoes: { none: {} } },
      orderBy: { data: "desc" },
      take: 100,
    }),
    db.pendenciaConciliacao.findMany({ where: { contaId: id, resolvidoEm: null }, orderBy: { data: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Conciliação — {conta.nome}</h1>

      <ConciliacaoForms
        contaId={id}
        criarLinhaExtratoAction={criarLinhaExtrato.bind(null, id)}
        conciliarAction={conciliarMovimentacao.bind(null, id)}
        criarPendenciaAction={criarPendencia.bind(null, id)}
        movimentosPendentes={movimentosPendentes.map((m) => ({
          id: m.id,
          label: `${formatarData(m.criadoEm)} · ${m.descricao} · ${formatarMoeda(m.valor)}`,
        }))}
        linhasExtrato={linhasExtrato.map((l) => ({
          id: l.id,
          label: `${formatarData(l.data)} · ${l.descricao} · ${formatarMoeda(l.valor)}`,
        }))}
      />

      <div className="space-y-2">
        <h2 className="text-base font-semibold">Movimentos do sistema ainda não conciliados</h2>
        {movimentosPendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum — tudo conciliado.</p>
        ) : (
          <ul className="space-y-2">
            {movimentosPendentes.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate">{m.descricao}</div>
                  <div className="text-xs text-muted-foreground">{formatarData(m.criadoEm)}</div>
                </div>
                <span className="flex-none font-medium">{formatarMoeda(m.valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold">Linhas do extrato ainda sem correspondência</h2>
        {linhasExtrato.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma.</p>
        ) : (
          <ul className="space-y-2">
            {linhasExtrato.map((l) => (
              <li key={l.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate">{l.descricao}</div>
                  <div className="text-xs text-muted-foreground">{formatarData(l.data)}</div>
                </div>
                <span className="flex-none font-medium">{formatarMoeda(l.valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {movimentosConciliados.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Conciliados recentemente</h2>
          <ul className="space-y-2">
            {movimentosConciliados.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate">{m.descricao}</div>
                  <div className="text-xs text-muted-foreground">{m.conciliadoEm && formatarData(m.conciliadoEm)}</div>
                </div>
                <form action={desconciliarMovimentacao.bind(null, id, m.id)}>
                  <button type="submit" className="flex-none text-xs font-medium text-destructive">Desfazer</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendencias.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Pendências</h2>
          <ul className="space-y-2">
            {pendencias.map((p) => (
              <li key={p.id} className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>{formatarData(p.data)} · {p.tipo === "entrada" ? "Entrada" : "Saída"}</span>
                  <span className="font-medium">{formatarMoeda(p.valor)}</span>
                </div>
                {p.comentario && <div className="text-xs text-muted-foreground">{p.comentario}</div>}
                <form action={resolverPendencia.bind(null, id, p.id)}>
                  <button type="submit" className="text-xs font-medium text-primary">Marcar como resolvida</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
