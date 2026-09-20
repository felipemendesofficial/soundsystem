import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR");
}

export default async function DetalheRenegociacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const renegociacao = await db.renegociacao.findFirst({
    where: { id, empresaId },
    include: {
      origens: { include: { lancamento: { include: { cliente: true, fornecedor: true } } } },
      destinos: { include: { lancamento: { include: { cliente: true, fornecedor: true } } } },
      criadoPor: true,
    },
  });
  if (!renegociacao) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Renegociação</h1>
        <Badge variant={renegociacao.tipo === "despesa" ? "secondary" : "default"}>
          {renegociacao.tipo === "despesa" ? "Despesa" : "Receita"}
        </Badge>
      </div>

      <div className="space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Motivo</span><span className="font-medium">{renegociacao.motivo}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span className="font-medium">{formatarData(renegociacao.criadoEm)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Criado por</span><span className="font-medium">{renegociacao.criadoPor.nome}</span></div>
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
          {renegociacao.destinos.map((d) => (
            <li key={d.id}>
              <Link href={`/lancamentos-financeiros/${d.lancamentoId}`} className="block rounded-lg border border-border bg-card p-3 text-sm active:bg-accent">
                <div className="flex justify-between">
                  <span className="font-medium">{d.lancamento.historicoSimplificado}</span>
                  <span>{formatarMoeda(d.lancamento.valorOriginal)}</span>
                </div>
                <div className="text-xs text-muted-foreground">{d.lancamento.cliente?.nome ?? d.lancamento.fornecedor?.nome ?? "-"}</div>
                <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <span>Juros: {formatarMoeda(d.juros)}</span>
                  <span>Multa: {formatarMoeda(d.multa)}</span>
                  <span>Desconto: {formatarMoeda(d.desconto)}</span>
                </div>
                {d.justificativaDesconto && <p className="mt-1 text-xs italic text-muted-foreground">{d.justificativaDesconto}</p>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
