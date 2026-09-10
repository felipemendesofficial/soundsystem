import Link from "next/link";
import { db } from "@/lib/db";
import type { StatusLancamento } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { StatusLancamentoFilter } from "@/components/status-lancamento-filter";
import { DataLancamentoFilter } from "@/components/data-lancamento-filter";
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

function paraISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Intervalo do dia em horário local (mesmo critério do resto do app — ex.:
// `obterVisaoGeralVendas` na home — que usa Date local sem fuso explícito).
function intervaloDoDia(dataISO: string) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  return { gte: new Date(ano, mes - 1, dia), lt: new Date(ano, mes - 1, dia + 1) };
}

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; data?: string }>;
}) {
  const { status, data } = await searchParams;
  const hojeISO = paraISO(new Date());
  const dataFiltro = data === "todos" ? null : (data ?? hojeISO);

  const lancamentos = await db.lancamento.findMany({
    where: {
      ...(status ? { status: status as StatusLancamento } : {}),
      ...(dataFiltro ? { criadoEm: intervaloDoDia(dataFiltro) } : {}),
    },
    include: {
      deposito: true,
      depositoOrigem: true,
      depositoDestino: true,
      itens: { include: { produto: true } },
    },
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
    buscaTexto: [`lançamento #${l.numero}`, TIPO_LABEL[l.tipo], ...l.itens.map((i) => i.produto.nome)]
      .join(" ")
      .toLowerCase(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lançamentos</h1>
        <Button render={<Link href="/lancamentos/novo" />}>Novo Lançamento</Button>
      </div>

      <StatusLancamentoFilter />
      <DataLancamentoFilter padrao={hojeISO} />

      <LancamentosLista itens={itensLista} />
    </div>
  );
}
