import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstornarTransferenciaButton } from "@/components/estornar-transferencia-button";
import { estornarTransferencia } from "./actions";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function TransferenciasEntreContasPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const transferencias = await db.transferenciaEntreContas.findMany({
    where: { empresaId: session.user.empresaId! },
    include: {
      contaOrigem: true,
      contaDestino: true,
      origemCliente: true,
      origemFornecedor: true,
      destinoCliente: true,
      destinoFornecedor: true,
    },
    orderBy: { data: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transferências entre Contas</h1>
        <Button render={<Link href="/transferencias-entre-contas/novo" />}>Nova</Button>
      </div>

      {transferencias.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma transferência registrada.
        </p>
      ) : (
        <ul className="space-y-2">
          {transferencias.map((t) => {
            const semOrigemReal = t.contaOrigemId === t.contaDestinoId;
            const origemTerceiro = t.origemCliente?.nome ?? t.origemFornecedor?.nome;
            const destinoTerceiro = t.destinoCliente?.nome ?? t.destinoFornecedor?.nome;
            return (
              <li key={t.id} className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{semOrigemReal ? "—" : t.contaOrigem.nome} → {t.contaDestino.nome}</span>
                  <Badge variant={t.estornada ? "secondary" : "default"}>{t.estornada ? "Estornada" : "Ativa"}</Badge>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{formatarData(t.data)}</span>
                  <span className="font-medium text-foreground">{formatarMoeda(t.valor)}</span>
                </div>
                {t.historico && <div className="text-xs text-muted-foreground">{t.historico}</div>}
                {origemTerceiro && <div className="text-xs text-muted-foreground">Adiantamento de origem: {origemTerceiro}</div>}
                {destinoTerceiro && <div className="text-xs text-muted-foreground">Adiantamento de destino: {destinoTerceiro}</div>}
                {!t.estornada && !t.estornoDeId && (
                  <div className="pt-1">
                    <EstornarTransferenciaButton action={estornarTransferencia.bind(null, t.id)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
