import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import {
  criarPendencia,
  resolverPendencia,
  estornarResolucaoPendencia,
  vincularPendenciaAMovimento,
} from "./actions";
import { FormPendencia, FormVincularPendencia, FormResolverPendencia } from "./conciliacao-forms";

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

  const [movimentosPendentes, pendencias, pendenciasResolvidasSemVinculo] = await Promise.all([
    db.movimentacaoFinanceira.findMany({
      where: { contaId: id, statusConciliacao: "pendente" },
      orderBy: { criadoEm: "desc" },
      take: 100,
    }),
    db.pendenciaConciliacao.findMany({ where: { contaId: id, resolvidoEm: null }, orderBy: { data: "desc" } }),
    db.pendenciaConciliacao.findMany({
      where: { contaId: id, resolvidoEm: { not: null }, movimentacaoVinculadaId: null },
      orderBy: { resolvidoEm: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Conciliação — {conta.nome}</h1>

      <FormPendencia action={criarPendencia.bind(null, id)} />

      <div className="space-y-2">
        <h2 className="text-base font-semibold">Pendências — lançadas no banco, ainda não reconhecidas pela empresa</h2>
        {pendencias.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma pendência em aberto.</p>
        ) : (
          <ul className="space-y-2">
            {pendencias.map((p) => (
              <li key={p.id} className="space-y-2 rounded-lg border border-border bg-card p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>{formatarData(p.data)} · {p.tipo === "entrada" ? "Entrada" : "Saída"}</span>
                  <span className="font-medium">{formatarMoeda(p.valor)}</span>
                </div>
                {p.comentario && <div className="text-xs text-muted-foreground">{p.comentario}</div>}
                <FormVincularPendencia
                  action={vincularPendenciaAMovimento.bind(null, id)}
                  pendenciaId={p.id}
                  movimentosPendentes={movimentosPendentes.map((m) => ({
                    id: m.id,
                    label: `${formatarData(m.criadoEm)} · ${m.descricao} · ${formatarMoeda(m.valor)}`,
                  }))}
                />
                <FormResolverPendencia action={resolverPendencia.bind(null, id)} pendenciaId={p.id} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {pendenciasResolvidasSemVinculo.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Pendências resolvidas sem vínculo</h2>
          <ul className="space-y-2">
            {pendenciasResolvidasSemVinculo.map((p) => (
              <li key={p.id} className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>{formatarData(p.data)} · {p.tipo === "entrada" ? "Entrada" : "Saída"}</span>
                  <span className="font-medium">{formatarMoeda(p.valor)}</span>
                </div>
                {p.comentario && <div className="text-xs text-muted-foreground">{p.comentario}</div>}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Resolvida em {formatarData(p.resolvidoEm!)}</span>
                  <form action={estornarResolucaoPendencia.bind(null, id, p.id)}>
                    <button type="submit" className="font-medium text-destructive">Estornar</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

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
    </div>
  );
}
