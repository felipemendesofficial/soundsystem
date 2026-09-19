import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { obterExtratoAdiantamento, type LinhaExtratoAdiantamento } from "@/lib/extrato-adiantamento";
import { PeriodoFilter } from "@/components/periodo-filter";
import { primeiroDiaDoMesISO, ultimoDiaDoMesISO, intervaloPeriodo } from "@/lib/periodo";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** O saldoAnterior/saldoPosterior de cada linha vem do replay do histórico COMPLETO — o
 * período só filtra quais linhas aparecem na tela, nunca recalcula o saldo a partir de zero. */
function filtrarPeriodo(
  extrato: LinhaExtratoAdiantamento[],
  filtro: { gte: Date; lt: Date } | null
): LinhaExtratoAdiantamento[] {
  if (!filtro) return extrato;
  return extrato.filter((l) => l.data >= filtro.gte && l.data < filtro.lt);
}

export default async function SaldoAdiantamentoClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string; dataInicio?: string; dataFim?: string }>;
}) {
  const { id } = await params;
  const { periodo, dataInicio, dataFim } = await searchParams;
  const session = await auth();
  const grupoId = session!.user.grupoId!;
  const cliente = await db.cliente.findFirst({ where: { id, grupoId } });
  if (!cliente) notFound();

  const hoje = new Date();
  const padraoInicio = primeiroDiaDoMesISO(hoje);
  const padraoFim = ultimoDiaDoMesISO(hoje);
  const filtroPeriodo = periodo === "todos" ? null : intervaloPeriodo(dataInicio ?? padraoInicio, dataFim ?? padraoFim);

  const saldos = await db.saldoAdiantamentoTerceiro.findMany({ where: { clienteId: id }, include: { conta: true } });
  const extratosPorConta = await Promise.all(
    saldos.map((s) => obterExtratoAdiantamento(s.contaId, { clienteId: id }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Saldo de Adiantamento</h1>
        <p className="text-sm text-muted-foreground">{cliente.nome}</p>
      </div>

      <PeriodoFilter padraoInicio={padraoInicio} padraoFim={padraoFim} />

      {saldos.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum saldo de adiantamento registrado.
        </p>
      ) : (
        <div className="space-y-6">
          {saldos.map((s, i) => {
            const extrato = filtrarPeriodo(extratosPorConta[i], filtroPeriodo);
            return (
              <div key={s.id} className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
                  <span className="font-semibold">{s.conta.nome}</span>
                  <span className="text-base font-semibold">{formatarMoeda(s.saldoAtual)}</span>
                </div>

                {extrato.length === 0 ? (
                  <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Nenhum lançamento {filtroPeriodo ? "no período selecionado" : "encontrado"} para esta conta.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {[...extrato].reverse().map((linha, idx) => (
                      <li key={idx} className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm">
                        <div className="flex justify-between">
                          <span className="truncate pr-2 text-muted-foreground">{linha.descricao}</span>
                          <span className={`flex-none font-medium ${linha.valor.greaterThanOrEqualTo(0) ? "text-brand-green" : "text-destructive"}`}>
                            {linha.valor.greaterThanOrEqualTo(0) ? "+" : "−"} {formatarMoeda(linha.valor.abs())}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{formatarData(linha.data)}</span>
                          <span>Saldo: {formatarMoeda(linha.saldoPosterior)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Link href="/clientes" className="block text-center text-sm font-medium text-primary">
        Voltar para Clientes
      </Link>
    </div>
  );
}
