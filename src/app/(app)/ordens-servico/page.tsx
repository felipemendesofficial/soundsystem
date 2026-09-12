import Link from "next/link";
import { db } from "@/lib/db";
import type { StatusOS } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { StatusOSFilter } from "@/components/status-os-filter";
import { PeriodoFilter } from "@/components/periodo-filter";
import { OrdensServicoLista, type ItemOrdemServico } from "@/components/ordens-servico-lista";
import { primeiroDiaDoMesISO, ultimoDiaDoMesISO, intervaloPeriodo } from "@/lib/periodo";

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  aberta: "secondary",
  em_andamento: "secondary",
  concluida: "default",
  cancelada: "destructive",
};

export default async function OrdensServicoPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; periodo?: string; dataInicio?: string; dataFim?: string }>;
}) {
  const { status, periodo, dataInicio, dataFim } = await searchParams;

  const hoje = new Date();
  const padraoInicio = primeiroDiaDoMesISO(hoje);
  const padraoFim = ultimoDiaDoMesISO(hoje);
  const filtroPeriodo =
    periodo === "todos" ? null : intervaloPeriodo(dataInicio ?? padraoInicio, dataFim ?? padraoFim);

  const ordens = await db.ordemServico.findMany({
    where: {
      ...(status ? { status: status as StatusOS } : {}),
      ...(filtroPeriodo ? { criadaEm: filtroPeriodo } : {}),
    },
    include: {
      cliente: true,
      itensProduto: { include: { produto: true } },
      itensServico: { include: { servico: true } },
    },
    orderBy: { numero: "desc" },
  });

  const itensLista: ItemOrdemServico[] = ordens.map((os) => {
    const totalProdutos = os.itensProduto.reduce((acc, i) => acc + Number(i.quantidade) * Number(i.precoUnitario), 0);
    const totalServicos = os.itensServico.reduce((acc, i) => acc + Number(i.quantidade) * Number(i.precoUnitario), 0);
    const total = totalProdutos + totalServicos;

    return {
      id: os.id,
      numero: os.numero,
      clienteNome: os.cliente.nome,
      statusLabel: STATUS_LABEL[os.status],
      statusVariant: STATUS_VARIANT[os.status],
      total: total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      buscaTexto: [
        `os #${os.numero}`,
        os.cliente.nome,
        ...os.itensProduto.map((i) => i.produto.nome),
        ...os.itensServico.map((i) => i.servico.nome),
      ]
        .join(" ")
        .toLowerCase(),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ordens de Serviço</h1>
        <Button render={<Link href="/ordens-servico/nova" />}>Nova OS</Button>
      </div>

      <StatusOSFilter />
      <PeriodoFilter padraoInicio={padraoInicio} padraoFim={padraoFim} />

      <OrdensServicoLista itens={itensLista} />
    </div>
  );
}
