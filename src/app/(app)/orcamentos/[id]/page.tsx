import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { OrcamentoForm } from "@/components/orcamento-form";
import { OrcamentoStatusActions } from "@/components/orcamento-status-actions";
import { atualizarOrcamento, cancelarFechamentoOrcamento, finalizarOrcamento } from "../actions";

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  fechado: "Fechado",
};

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarPercentual(valor: number) {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export default async function DetalheOrcamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [orcamento, depositos, fornecedores, produtos] = await Promise.all([
    db.orcamento.findUnique({
      where: { id },
      include: {
        deposito: true,
        fornecedor: true,
        itens: { include: { produto: true } },
      },
    }),
    db.deposito.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    db.fornecedor.findMany({ orderBy: { nome: "asc" } }),
    db.produto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
  ]);
  if (!orcamento) notFound();

  const editavel = orcamento.status === "aberto";

  const valorVendaTotal = orcamento.itens.reduce(
    (acc, i) => acc + Number(i.valorEstimadoVenda) * Number(i.quantidade),
    0
  );
  const valorCompraTotal = orcamento.itens.reduce(
    (acc, i) => acc + Number(i.custoCompraUnitario ?? 0) * Number(i.quantidade),
    0
  );
  const taxaRevendaEfetiva = valorVendaTotal > 0 ? (1 - valorCompraTotal / valorVendaTotal) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Orçamento #{orcamento.numero}</h1>
          <p className="text-sm text-muted-foreground">{orcamento.descricao ?? "Sem descrição"}</p>
        </div>
        <Badge variant={orcamento.status === "fechado" ? "default" : "secondary"}>
          {STATUS_LABEL[orcamento.status]}
        </Badge>
      </div>

      <OrcamentoStatusActions
        status={orcamento.status}
        finalizarAction={finalizarOrcamento.bind(null, id)}
        cancelarFechamentoAction={cancelarFechamentoOrcamento.bind(null, id)}
      />

      {editavel ? (
        <OrcamentoForm
          action={atualizarOrcamento.bind(null, id)}
          depositos={depositos.map((d) => ({ id: d.id, label: d.nome }))}
          fornecedores={fornecedores.map((f) => ({ id: f.id, label: f.nome }))}
          produtos={produtos.map((p) => ({ id: p.id, label: `${p.nome} — ${p.sku}` }))}
          defaultValues={{
            descricao: orcamento.descricao,
            depositoId: orcamento.depositoId,
            fornecedorId: orcamento.fornecedorId,
            modoCalculo: orcamento.valorCompraTotalInformado !== null ? "valor_total" : "taxa",
            taxaRevenda: orcamento.taxaRevenda?.toString() ?? "30",
            valorCompraTotalInformado: orcamento.valorCompraTotalInformado?.toString() ?? "",
            itens: orcamento.itens.map((i) => ({
              produtoId: i.produtoId,
              label: `${i.produto.nome} — ${i.produto.sku}`,
              quantidade: i.quantidade.toString(),
              valorEstimadoVenda: i.valorEstimadoVenda.toString(),
            })),
          }}
        />
      ) : (
        <div className="max-w-lg space-y-6">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <div className="mb-1 truncate text-[13px] text-muted-foreground">Depósito</div>
                <div className="truncate text-[15.5px] font-medium">{orcamento.deposito.nome}</div>
              </div>
              {orcamento.fornecedor && (
                <div className="min-w-0">
                  <div className="mb-1 truncate text-[13px] text-muted-foreground">Fornecedor</div>
                  <div className="truncate text-[15.5px] font-medium">{orcamento.fornecedor.nome}</div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-[13px] font-medium uppercase text-muted-foreground">Itens (custo de compra)</div>
              <ul className="space-y-2">
                {orcamento.itens.map((i) => (
                  <li key={i.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/kardex/${i.produtoId}`} className="min-w-0 truncate text-primary underline-offset-2 hover:underline">
                        {i.produto.nome} × {Number(i.quantidade)}
                      </Link>
                      <span className="flex-none font-medium">
                        {formatarMoeda(Number(i.custoCompraUnitario ?? 0) * Number(i.quantidade))}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Venda estimada {formatarMoeda(i.valorEstimadoVenda)} · Custo unit.{" "}
                      {formatarMoeda(i.custoCompraUnitario ?? 0)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total estimado de venda</span>
                <span className="font-medium">{formatarMoeda(valorVendaTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total pago na compra</span>
                <span className="font-medium">{formatarMoeda(valorCompraTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Taxa de revenda efetiva</span>
                <span className="font-medium">{formatarPercentual(taxaRevendaEfetiva)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
