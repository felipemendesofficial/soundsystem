import Link from "next/link";
import { db } from "@/lib/db";
import type { StatusOrcamento } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { StatusOrcamentoFilter } from "@/components/status-orcamento-filter";
import { OrcamentosLista, type ItemOrcamento } from "@/components/orcamentos-lista";
import { calcularRateio } from "@/lib/orcamento";

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  fechado: "Fechado",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  aberto: "secondary",
  fechado: "default",
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  const orcamentos = await db.orcamento.findMany({
    where: status ? { status: status as StatusOrcamento } : undefined,
    include: { itens: true },
    orderBy: { numero: "desc" },
  });

  const itensLista: ItemOrcamento[] = orcamentos.map((o) => {
    const valorCompraTotal =
      o.status === "fechado"
        ? o.itens.reduce((acc, i) => acc + Number(i.custoCompraUnitario ?? 0) * Number(i.quantidade), 0)
        : Number(
            calcularRateio(
              o.itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade, valorEstimadoVenda: i.valorEstimadoVenda })),
              { taxaRevenda: o.taxaRevenda, valorCompraTotalInformado: o.valorCompraTotalInformado }
            ).valorCompraTotal
          );

    return {
      id: o.id,
      numero: o.numero,
      descricao: o.descricao,
      statusLabel: STATUS_LABEL[o.status],
      statusVariant: STATUS_VARIANT[o.status],
      valorCompraTotal: formatarMoeda(valorCompraTotal),
      buscaTexto: [`orçamento #${o.numero}`, o.descricao ?? ""].join(" ").toLowerCase(),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orçamentos de Compra</h1>
        <Button render={<Link href="/orcamentos/novo" />}>Novo Orçamento</Button>
      </div>

      <StatusOrcamentoFilter />

      <OrcamentosLista itens={itensLista} />
    </div>
  );
}
