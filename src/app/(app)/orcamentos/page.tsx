import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { StatusOrcamento } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { StatusOrcamentoFilter } from "@/components/status-orcamento-filter";
import { PeriodoFilter } from "@/components/periodo-filter";
import { OrcamentosLista, type ItemOrcamento } from "@/components/orcamentos-lista";
import { calcularRateio } from "@/lib/orcamento";
import { primeiroDiaDoMesISO, ultimoDiaDoMesISO, intervaloPeriodo } from "@/lib/periodo";

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

function formatarPercentual(valor: number) {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; periodo?: string; dataInicio?: string; dataFim?: string }>;
}) {
  const { status, periodo, dataInicio, dataFim } = await searchParams;
  const session = await auth();

  const hoje = new Date();
  const padraoInicio = primeiroDiaDoMesISO(hoje);
  const padraoFim = ultimoDiaDoMesISO(hoje);
  const filtroPeriodo =
    periodo === "todos" ? null : intervaloPeriodo(dataInicio ?? padraoInicio, dataFim ?? padraoFim);

  const orcamentos = await db.orcamento.findMany({
    where: {
      empresaId: session!.user.empresaId!,
      ...(status ? { status: status as StatusOrcamento } : {}),
      ...(filtroPeriodo ? { criadoEm: filtroPeriodo } : {}),
    },
    include: { itens: true },
    orderBy: { numero: "desc" },
  });

  const itensLista: ItemOrcamento[] = orcamentos.map((o) => {
    const valorVendaTotal = o.itens.reduce((acc, i) => acc + Number(i.valorEstimadoVenda) * Number(i.quantidade), 0);
    const valorCompraTotal =
      o.status === "fechado"
        ? o.itens.reduce((acc, i) => acc + Number(i.custoCompraUnitario ?? 0) * Number(i.quantidade), 0)
        : Number(
            calcularRateio(
              o.itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade, valorEstimadoVenda: i.valorEstimadoVenda })),
              { taxaRevenda: o.taxaRevenda, valorCompraTotalInformado: o.valorCompraTotalInformado }
            ).valorCompraTotal
          );
    const taxaRevendaEfetiva = valorVendaTotal > 0 ? (1 - valorCompraTotal / valorVendaTotal) * 100 : 0;

    return {
      id: o.id,
      numero: o.numero,
      descricao: o.descricao,
      statusLabel: STATUS_LABEL[o.status],
      statusVariant: STATUS_VARIANT[o.status],
      valorVendaTotal: formatarMoeda(valorVendaTotal),
      valorCompraTotal: formatarMoeda(valorCompraTotal),
      taxaRevendaEfetiva: formatarPercentual(taxaRevendaEfetiva),
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
      <PeriodoFilter padraoInicio={padraoInicio} padraoFim={padraoFim} />

      <OrcamentosLista itens={itensLista} />
    </div>
  );
}
