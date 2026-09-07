import Link from "next/link";
import { db } from "@/lib/db";
import type { StatusOS } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { StatusOSFilter } from "@/components/status-os-filter";
import { OrdensServicoLista, type ItemOrdemServico } from "@/components/ordens-servico-lista";

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
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  const ordens = await db.ordemServico.findMany({
    where: status ? { status: status as StatusOS } : undefined,
    include: {
      cliente: true,
      itensProduto: true,
      itensServico: true,
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
      buscaTexto: [`os #${os.numero}`, os.cliente.nome].join(" ").toLowerCase(),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ordens de Serviço</h1>
        <Button render={<Link href="/ordens-servico/nova" />}>Nova OS</Button>
      </div>

      <StatusOSFilter />

      <OrdensServicoLista itens={itensLista} />
    </div>
  );
}
