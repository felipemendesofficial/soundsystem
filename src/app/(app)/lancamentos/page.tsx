import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { StatusLancamento } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { StatusLancamentoFilter } from "@/components/status-lancamento-filter";
import { PeriodoFilter } from "@/components/periodo-filter";
import { LancamentosLista, type ItemLancamento } from "@/components/lancamentos-lista";
import { podeVerCusto } from "@/lib/permissions";
import { primeiroDiaDoMesISO, ultimoDiaDoMesISO, intervaloPeriodo } from "@/lib/periodo";

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

const ENTRADA_TIPOS = new Set(["compra", "devolucao_cliente", "ajuste_entrada"]);

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; periodo?: string; dataInicio?: string; dataFim?: string }>;
}) {
  const { status, periodo, dataInicio, dataFim } = await searchParams;
  const session = await auth();
  const mostrarCusto = podeVerCusto(session!.user.perfil);

  const hoje = new Date();
  const padraoInicio = primeiroDiaDoMesISO(hoje);
  const padraoFim = ultimoDiaDoMesISO(hoje);
  const filtroPeriodo =
    periodo === "todos" ? null : intervaloPeriodo(dataInicio ?? padraoInicio, dataFim ?? padraoFim);

  const lancamentos = await db.lancamento.findMany({
    where: {
      empresaId: session!.user.empresaId!,
      ...(status ? { status: status as StatusLancamento } : {}),
      ...(filtroPeriodo ? { criadoEm: filtroPeriodo } : {}),
    },
    include: {
      deposito: true,
      depositoOrigem: true,
      depositoDestino: true,
      itens: { include: { produto: true } },
    },
    orderBy: { numero: "desc" },
  });

  const itensLista: ItemLancamento[] = lancamentos.map((l) => {
    const ehEntrada = ENTRADA_TIPOS.has(l.tipo);
    const ehVenda = l.tipo === "venda";

    let total = "-";
    if (ehEntrada && mostrarCusto) {
      total = formatarMoeda(l.itens.reduce((acc, i) => acc + Number(i.quantidade) * Number(i.custoUnitario ?? 0), 0));
    } else if (ehVenda) {
      total = formatarMoeda(l.itens.reduce((acc, i) => acc + Number(i.quantidade) * Number(i.precoVenda ?? 0), 0));
    }

    return {
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
      total,
      buscaTexto: [`lançamento #${l.numero}`, TIPO_LABEL[l.tipo], ...l.itens.map((i) => i.produto.nome)]
        .join(" ")
        .toLowerCase(),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lançamentos</h1>
        <Button render={<Link href="/lancamentos/novo" />}>Novo Lançamento</Button>
      </div>

      <StatusLancamentoFilter />
      <PeriodoFilter padraoInicio={padraoInicio} padraoFim={padraoFim} />

      <LancamentosLista itens={itensLista} />
    </div>
  );
}
