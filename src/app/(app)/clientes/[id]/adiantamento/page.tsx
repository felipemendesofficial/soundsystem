import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { obterExtratoAdiantamento } from "@/lib/extrato-adiantamento";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function SaldoAdiantamentoClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const grupoId = session!.user.grupoId!;
  const cliente = await db.cliente.findFirst({ where: { id, grupoId } });
  if (!cliente) notFound();

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

      {saldos.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum saldo de adiantamento registrado.
        </p>
      ) : (
        <div className="space-y-6">
          {saldos.map((s, i) => {
            const extrato = extratosPorConta[i];
            return (
              <div key={s.id} className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
                  <span className="font-semibold">{s.conta.nome}</span>
                  <span className="text-base font-semibold">{formatarMoeda(s.saldoAtual)}</span>
                </div>

                {extrato.length === 0 ? (
                  <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Nenhum lançamento encontrado para esta conta.
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
