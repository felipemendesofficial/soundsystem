import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataHora(data: Date) {
  return data.toLocaleString("pt-BR");
}

export default async function ExtratoComissaoVendedorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const vendedor = await db.vendedor.findFirst({ where: { id, grupoId: session!.user.grupoId! } });
  if (!vendedor) notFound();

  const extrato = await db.movimentacaoComissaoVendedor.findMany({
    where: { vendedorId: id },
    orderBy: { criadoEm: "desc" },
    include: {
      comissao: {
        include: {
          lancamento: { include: { cliente: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Extrato de Comissão</h1>
        <p className="text-sm text-muted-foreground">{vendedor.nome}</p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 text-sm">
        <span className="text-muted-foreground">Saldo atual</span>
        <span className="text-base font-semibold">{formatarMoeda(vendedor.saldoComissao)}</span>
      </div>

      {extrato.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma movimentação de comissão registrada.
        </p>
      ) : (
        <ul className="space-y-2">
          {extrato.map((m) => {
            const cliente = m.comissao.lancamento.cliente?.nome;
            const valorVenda = m.comissao.lancamento.valorOriginal;
            const aliquota = m.comissao.percentual;
            return (
              <li key={m.id} className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm">
                <div className="flex justify-between">
                  <span className="truncate pr-2 text-muted-foreground">{m.descricao}</span>
                  <span className={`flex-none font-medium ${m.tipo === "entrada" ? "text-brand-green" : "text-destructive"}`}>
                    {m.tipo === "entrada" ? "+" : "−"} {formatarMoeda(m.valor)}
                  </span>
                </div>
                {(cliente || valorVenda) && (
                  <div className="text-xs text-muted-foreground">
                    {cliente && <>Cliente: {cliente} · </>}
                    Venda: {formatarMoeda(valorVenda)} · Alíquota: {Number(aliquota).toLocaleString("pt-BR")}%
                  </div>
                )}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatarDataHora(m.criadoEm)}</span>
                  <span>Saldo: {formatarMoeda(m.saldoPosterior)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/vendedores" className="block text-center text-sm font-medium text-primary">
        Voltar para Vendedores
      </Link>
    </div>
  );
}
