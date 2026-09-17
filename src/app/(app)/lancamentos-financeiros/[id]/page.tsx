import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  baixado: "Baixado",
  estornado: "Estornado",
  cancelado: "Cancelado",
};

export default async function LancamentoFinanceiroDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const lancamento = await db.lancamentoFinanceiro.findFirst({
    where: { id, empresaId: session.user.empresaId! },
    include: {
      cliente: true,
      fornecedor: true,
      portador: true,
      contaPrevista: true,
      processo: true,
      dadosCheque: true,
      dadosCartao: true,
      rateios: { include: { plano: true, rateiosCentroCusto: { include: { centroCusto: true } } } },
      rateiosProcesso: { include: { processoItem: true } },
      retencoes: { include: { plano: true } },
      comissoes: { include: { vendedor: true } },
      baixas: { include: { conta: true, estorno: { include: { conta: true } } }, orderBy: { dataBaixa: "desc" } },
    },
  });
  if (!lancamento) notFound();

  const contraparte = lancamento.cliente?.nome ?? lancamento.fornecedor?.nome ?? "-";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{lancamento.historicoSimplificado}</h1>
        </div>
        <div className="mt-2 flex gap-1.5">
          <Badge variant={lancamento.tipo === "receita" ? "default" : "outline"}>
            {lancamento.tipo === "receita" ? "Receita" : "Despesa"}
          </Badge>
          <Badge variant={lancamento.status === "aberto" ? "secondary" : "default"}>
            {STATUS_LABEL[lancamento.status]}
          </Badge>
        </div>
      </div>

      <div className="space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Valor original</span><span className="font-medium">{formatarMoeda(lancamento.valorOriginal)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">{lancamento.tipo === "receita" ? "Cliente" : "Fornecedor"}</span><span className="font-medium">{contraparte}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Emissão</span><span className="font-medium">{formatarData(lancamento.dataEmissao)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Vencimento</span><span className="font-medium">{formatarData(lancamento.dataVencimento)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Processo</span><span className="font-medium">{lancamento.processo.nome}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Documento</span><span className="font-medium">{lancamento.documento ?? "-"}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Portador</span><span className="font-medium">{lancamento.portador?.nome ?? "-"}</span></div>
        {lancamento.observacao && (
          <div className="pt-1 text-muted-foreground">Obs.: {lancamento.observacao}</div>
        )}
      </div>

      {lancamento.rateios.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Rateio — Plano Financeiro</h2>
          <ul className="space-y-2">
            {lancamento.rateios.map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                <div className="flex justify-between">
                  <span>{r.plano.codigo} — {r.plano.descricao}</span>
                  <span className="font-medium">{r.percentual.toString()}% · {formatarMoeda(r.valor)}</span>
                </div>
                {r.rateiosCentroCusto.length > 0 && (
                  <ul className="mt-2 space-y-1 border-l border-border pl-3 text-xs text-muted-foreground">
                    {r.rateiosCentroCusto.map((cc) => (
                      <li key={cc.id} className="flex justify-between">
                        <span>{cc.centroCusto.codigo} — {cc.centroCusto.descricao}</span>
                        <span>{cc.percentual.toString()}% · {formatarMoeda(cc.valor)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {lancamento.rateiosProcesso.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Rateio — Processo</h2>
          <ul className="space-y-2">
            {lancamento.rateiosProcesso.map((r) => (
              <li key={r.id} className="flex justify-between rounded-lg border border-border bg-card p-3 text-sm">
                <span>{r.processoItem.codigo} — {r.processoItem.descricao}</span>
                <span className="font-medium">{r.percentual.toString()}% · {formatarMoeda(r.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lancamento.retencoes.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Retenções</h2>
          <ul className="space-y-2">
            {lancamento.retencoes.map((r) => (
              <li key={r.id} className="flex justify-between rounded-lg border border-border bg-card p-3 text-sm">
                <span>{r.plano.codigo} — {r.plano.descricao}</span>
                <span className="font-medium">{r.percentual.toString()}% · {formatarMoeda(r.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lancamento.comissoes.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Comissões</h2>
          <ul className="space-y-2">
            {lancamento.comissoes.map((c) => (
              <li key={c.id} className="flex justify-between rounded-lg border border-border bg-card p-3 text-sm">
                <span>{c.vendedor.nome}</span>
                <span className="font-medium">{c.percentual.toString()}% · {formatarMoeda(c.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lancamento.status === "aberto" && (
        <Button render={<Link href={`/lancamentos-financeiros/${id}/baixa`} />}>Dar Baixa</Button>
      )}

      {lancamento.baixas.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Baixas</h2>
          <ul className="space-y-2">
            {lancamento.baixas.map((b) => (
              <li key={b.id} className="space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{b.conta.nome}</span>
                  <Badge variant={b.estornada ? "secondary" : "default"}>{b.estornada ? "Estornada" : "Ativa"}</Badge>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span className="font-medium">{formatarData(b.dataBaixa)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Juros</span><span className="font-medium">{formatarMoeda(b.juros)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Multa</span><span className="font-medium">{formatarMoeda(b.multa)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span className="font-medium">{formatarMoeda(b.desconto)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor baixado</span><span className="font-medium">{formatarMoeda(b.valorBaixado)}</span></div>

                {b.estorno && (
                  <div className="mt-2 space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
                    <div className="flex justify-between"><span>Estornado em</span><span>{formatarData(b.estorno.dataEstorno)}</span></div>
                    <div className="flex justify-between"><span>Conta do estorno</span><span>{b.estorno.conta.nome}</span></div>
                    <div>Motivo: {b.estorno.motivo}</div>
                  </div>
                )}

                {!b.estornada && (
                  <div className="pt-2">
                    <Button size="sm" variant="outline" render={<Link href={`/lancamentos-financeiros/${id}/estorno`} />}>
                      Estornar Baixa
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
