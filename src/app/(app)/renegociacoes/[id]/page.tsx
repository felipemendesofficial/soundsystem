import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { ConfirmarAcaoButton } from "@/components/confirmar-acao-button";
import { fecharRenegociacao, cancelarRenegociacao, estornarRenegociacao } from "../actions";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR");
}

const STATUS_LABEL = { aberta: "Aberta", fechada: "Fechada", cancelada: "Cancelada", estornada: "Estornada" } as const;

export default async function DetalheRenegociacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const renegociacao = await db.renegociacao.findFirst({
    where: { id, empresaId },
    include: {
      origens: { include: { lancamento: { include: { cliente: true, fornecedor: true } } } },
      destinos: {
        include: {
          lancamento: { include: { cliente: true, fornecedor: true } },
          cliente: true,
          fornecedor: true,
        },
      },
      creditosUsados: { include: { creditoDevolucao: { include: { cliente: true, fornecedor: true } } } },
      criadoPor: true,
    },
  });
  if (!renegociacao) notFound();

  const algumDestinoBaixado = renegociacao.destinos.some((d) => d.lancamento && d.lancamento.status !== "aberto");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Renegociação</h1>
        <Badge variant={renegociacao.tipo === "despesa" ? "secondary" : "default"}>
          {renegociacao.tipo === "despesa" ? "Despesa" : "Receita"}
        </Badge>
        <Badge variant={renegociacao.status === "fechada" ? "default" : renegociacao.status === "aberta" ? "secondary" : "outline"}>
          {STATUS_LABEL[renegociacao.status]}
        </Badge>
      </div>

      <div className="space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Motivo</span><span className="font-medium">{renegociacao.motivo}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Criado</span><span className="font-medium">{formatarData(renegociacao.criadoEm)} · {renegociacao.criadoPor.nome}</span></div>
        {renegociacao.fechadoEm && (
          <div className="flex justify-between"><span className="text-muted-foreground">Fechada em</span><span className="font-medium">{formatarData(renegociacao.fechadoEm)}</span></div>
        )}
        {renegociacao.estornadoEm && (
          <div className="flex justify-between"><span className="text-muted-foreground">Estornada em</span><span className="font-medium">{formatarData(renegociacao.estornadoEm)}</span></div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold">Títulos de Origem</h2>
        <ul className="space-y-2">
          {renegociacao.origens.map((o) => (
            <li key={o.id}>
              <Link href={`/lancamentos-financeiros/${o.lancamentoId}`} className="block rounded-lg border border-border bg-card p-3 text-sm active:bg-accent">
                <div className="flex justify-between">
                  <span className="font-medium">{o.lancamento.historicoSimplificado}</span>
                  <span>{formatarMoeda(o.lancamento.valorOriginal)}</span>
                </div>
                <div className="text-xs text-muted-foreground">{o.lancamento.cliente?.nome ?? o.lancamento.fornecedor?.nome ?? "-"}</div>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold">Títulos de Destino</h2>
        <ul className="space-y-2">
          {renegociacao.destinos.map((d) => {
            const contraparte = d.lancamento?.cliente ?? d.lancamento?.fornecedor ?? d.cliente ?? d.fornecedor;
            const conteudo = (
              <>
                <div className="flex justify-between">
                  <span className="font-medium">{d.lancamento?.historicoSimplificado ?? d.historicoSimplificado}</span>
                  <span>{formatarMoeda(d.lancamento?.valorOriginal ?? d.valorOriginal)}</span>
                </div>
                <div className="text-xs text-muted-foreground">{contraparte?.nome ?? "-"}</div>
                <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <span>Juros: {formatarMoeda(d.juros)}</span>
                  <span>Multa: {formatarMoeda(d.multa)}</span>
                  <span>Desconto: {formatarMoeda(d.desconto)}</span>
                </div>
                {d.justificativaDesconto && <p className="mt-1 text-xs italic text-muted-foreground">{d.justificativaDesconto}</p>}
                {!d.lancamento && <p className="mt-1 text-xs text-muted-foreground">Ainda não gerado — será criado ao fechar a renegociação.</p>}
              </>
            );
            return (
              <li key={d.id}>
                {d.lancamento ? (
                  <Link href={`/lancamentos-financeiros/${d.lancamentoId}`} className="block rounded-lg border border-border bg-card p-3 text-sm active:bg-accent">
                    {conteudo}
                  </Link>
                ) : (
                  <div className="block rounded-lg border border-dashed border-border bg-card p-3 text-sm">{conteudo}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {renegociacao.creditosUsados.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Créditos de Devolução Usados</h2>
          <ul className="space-y-2">
            {renegociacao.creditosUsados.map((u) => {
              const terceiro = u.creditoDevolucao.cliente ?? u.creditoDevolucao.fornecedor;
              return (
                <li key={u.id} className="flex justify-between rounded-lg border border-border bg-card p-3 text-sm">
                  <span className="font-medium">{terceiro?.nome ?? "-"} — crédito de devolução</span>
                  <span>{formatarMoeda(u.valorUtilizado)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {renegociacao.status === "aberta" && (
          <>
            <ConfirmarAcaoButton
              action={fecharRenegociacao.bind(null, id)}
              label="Fechar"
              labelPendente="Fechando..."
              titulo="Fechar Renegociação?"
              descricao="Reclassifica os títulos de origem (viram 'Renegociado') e cria de verdade os títulos de destino, consumindo os créditos de devolução indicados. Não pode ser desfeito enquanto os novos títulos não forem baixados."
            />
            <ConfirmarAcaoButton
              action={cancelarRenegociacao.bind(null, id)}
              label="Cancelar"
              labelPendente="Cancelando..."
              titulo="Cancelar esta Renegociação?"
              descricao="Descarta o rascunho — nada foi reclassificado ainda, os títulos de origem e créditos ficam livres de novo pra uma futura renegociação."
              variant="outline"
            />
          </>
        )}
        {renegociacao.status === "fechada" && !algumDestinoBaixado && (
          <ConfirmarAcaoButton
            action={estornarRenegociacao.bind(null, id)}
            label="Estornar"
            labelPendente="Estornando..."
            titulo="Estornar esta Renegociação?"
            descricao="Cancela os títulos de destino, reabre os títulos de origem e devolve o saldo dos créditos de devolução usados."
            variant="outline"
          />
        )}
        {renegociacao.status === "fechada" && algumDestinoBaixado && (
          <p className="text-sm text-muted-foreground">Não é possível estornar: um ou mais títulos de destino já foram baixados.</p>
        )}
      </div>
    </div>
  );
}
