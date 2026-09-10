import Link from "next/link";
import { db } from "@/lib/db";
import type { StatusLancamento } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { StatusLancamentoFilter } from "@/components/status-lancamento-filter";
import { LancamentosLista, type ItemLancamento } from "@/components/lancamentos-lista";

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  fechado: "Fechado",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  aberto: "secondary",
  fechado: "default",
};

const TIPO_LABEL: Record<string, string> = {
  compra: "Compra",
  devolucao_cliente: "Devolução de Cliente",
  ajuste_entrada: "Ajuste (Entrada)",
  venda: "Venda",
  devolucao_fornecedor: "Devolução a Fornecedor",
  perda_avaria: "Perda / Avaria",
  uso_interno: "Uso Interno",
  ajuste_saida: "Ajuste (Saída)",
  transferencia: "Transferência",
};

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  const lancamentos = await db.lancamento.findMany({
    where: status ? { status: status as StatusLancamento } : undefined,
    include: { deposito: true, depositoOrigem: true, depositoDestino: true },
    orderBy: { numero: "desc" },
  });

  const itensLista: ItemLancamento[] = lancamentos.map((l) => ({
    id: l.id,
    numero: l.numero,
    tipoLabel: TIPO_LABEL[l.tipo],
    statusLabel: STATUS_LABEL[l.status],
    statusVariant: STATUS_VARIANT[l.status],
    depositoLabel:
      l.tipo === "transferencia"
        ? `${l.depositoOrigem?.nome ?? "-"} → ${l.depositoDestino?.nome ?? "-"}`
        : (l.deposito?.nome ?? "-"),
    data: new Date(l.criadoEm).toLocaleDateString("pt-BR"),
    buscaTexto: [`lançamento #${l.numero}`, TIPO_LABEL[l.tipo]].join(" ").toLowerCase(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lançamentos</h1>
        <Button render={<Link href="/lancamentos/novo" />}>Novo Lançamento</Button>
      </div>

      <StatusLancamentoFilter />

      <LancamentosLista itens={itensLista} />
    </div>
  );
}
