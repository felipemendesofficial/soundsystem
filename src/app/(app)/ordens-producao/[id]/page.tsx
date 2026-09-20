import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeLancarMovimentacao, podeVerCusto } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { ConfirmarAcaoButton } from "@/components/confirmar-acao-button";
import { processarOrdemProducao, estornarProcessamentoOrdemProducao, excluirOrdemProducao } from "../actions";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatarData(data: Date) {
  return data.toLocaleString("pt-BR");
}

export default async function DetalheOrdemProducaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeLancarMovimentacao(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;
  const verCusto = podeVerCusto(session.user.perfil);

  const ordem = await db.ordemProducao.findFirst({
    where: { id, empresaId },
    include: {
      produtoFinal: true,
      depositoEntrada: true,
      usuario: true,
      materiais: { include: { produto: true, deposito: true } },
      servicos: { include: { servico: true } },
    },
  });
  if (!ordem) notFound();

  const custoServicos = ordem.servicos.reduce((acc, s) => acc + Number(s.valor), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Ordem de Produção</h1>
        <Badge variant={ordem.status === "processada" ? "default" : "secondary"}>
          {ordem.status === "processada" ? "Processada" : "Aberta"}
        </Badge>
      </div>

      <div className="space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Produto Final</span><span className="font-medium">{ordem.produtoFinal.nome}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Quantidade de Entrada</span><span className="font-medium">{Number(ordem.quantidadeEntrada)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Depósito de Entrada</span><span className="font-medium">{ordem.depositoEntrada.nome}</span></div>
        {verCusto && ordem.custoUnitarioFinal !== null && (
          <div className="flex justify-between"><span className="text-muted-foreground">Custo Unitário Final</span><span className="font-medium">{formatarMoeda(ordem.custoUnitarioFinal)}</span></div>
        )}
        <div className="flex justify-between"><span className="text-muted-foreground">Criado por</span><span className="font-medium">{ordem.usuario.nome} · {formatarData(ordem.criadoEm)}</span></div>
        {ordem.processadoEm && (
          <div className="flex justify-between"><span className="text-muted-foreground">Processado em</span><span className="font-medium">{formatarData(ordem.processadoEm)}</span></div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold">Materiais</h2>
        <ul className="space-y-2">
          {ordem.materiais.map((m) => (
            <li key={m.id} className="rounded-lg border border-border bg-card p-3 text-sm">
              <div className="flex justify-between"><span className="font-medium">{m.produto.nome}</span><span>{Number(m.quantidade)}</span></div>
              <div className="text-xs text-muted-foreground">Saída de: {m.deposito.nome}</div>
              {verCusto && m.custoUnitarioDebitado !== null && (
                <div className="text-xs text-muted-foreground">Custo debitado: {formatarMoeda(m.custoUnitarioDebitado)}/un.</div>
              )}
            </li>
          ))}
          {ordem.materiais.length === 0 && <p className="text-sm text-muted-foreground">Nenhum material.</p>}
        </ul>
      </div>

      {ordem.servicos.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Serviços</h2>
          <ul className="space-y-2">
            {ordem.servicos.map((s) => (
              <li key={s.id} className="flex justify-between rounded-lg border border-border bg-card p-3 text-sm">
                <span className="font-medium">{s.servico.nome}</span>
                {verCusto && <span>{formatarMoeda(s.valor)}</span>}
              </li>
            ))}
          </ul>
          {verCusto && <p className="text-right text-xs text-muted-foreground">Total serviços: {formatarMoeda(custoServicos)}</p>}
        </div>
      )}

      <div className="flex gap-3">
        {ordem.status === "aberta" ? (
          <>
            <ConfirmarAcaoButton
              action={processarOrdemProducao.bind(null, id)}
              label="Processar"
              labelPendente="Processando..."
              titulo="Processar Ordem de Produção?"
              descricao="Consome os materiais dos depósitos indicados e gera a entrada do produto final com o custo médio recalculado. Pode ser revertido depois."
            />
            <ConfirmarAcaoButton
              action={excluirOrdemProducao.bind(null, id)}
              label="Excluir"
              labelPendente="Excluindo..."
              titulo="Excluir Ordem de Produção?"
              descricao="Só possível enquanto está aberta — nenhum estoque foi movimentado ainda."
              variant="outline"
            />
          </>
        ) : (
          <ConfirmarAcaoButton
            action={estornarProcessamentoOrdemProducao.bind(null, id)}
            label="Estornar Processamento"
            labelPendente="Estornando..."
            titulo="Estornar o processamento?"
            descricao="Devolve os materiais aos depósitos de origem e reverte a entrada do produto final. A Ordem volta pra Aberta."
            variant="outline"
          />
        )}
      </div>
    </div>
  );
}
