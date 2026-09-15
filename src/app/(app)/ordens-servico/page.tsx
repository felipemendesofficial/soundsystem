import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { StatusOS } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { StatusOSFilter } from "@/components/status-os-filter";
import { PeriodoFilter } from "@/components/periodo-filter";
import { OrdensServicoLista, type ItemOrdemServico } from "@/components/ordens-servico-lista";
import { primeiroDiaDoMesISO, ultimoDiaDoMesISO, intervaloPeriodo } from "@/lib/periodo";
import { podeVerCusto } from "@/lib/permissions";
import { obterCustoMedioCombinadoPorProduto } from "@/lib/tabela-preco";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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
  const session = await auth();
  const empresaId = session!.user.empresaId!;
  const mostrarCusto = podeVerCusto(session!.user.perfil);

  const hoje = new Date();
  const padraoInicio = primeiroDiaDoMesISO(hoje);
  const padraoFim = ultimoDiaDoMesISO(hoje);
  const filtroPeriodo =
    periodo === "todos" ? null : intervaloPeriodo(dataInicio ?? padraoInicio, dataFim ?? padraoFim);

  const ordens = await db.ordemServico.findMany({
    where: {
      empresaId,
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

  // Custo real (do Kardex) pras OS já concluídas — a mesma linha da baixa de
  // estoque feita em `concluirOrdemServico`; pras ainda abertas, usa o custo
  // médio atual do produto só como estimativa (pode mudar até a conclusão).
  const [movimentacoesOS, custoMedioPorProduto] = await Promise.all([
    db.movimentacao.findMany({
      where: { empresaId, tipoMovimento: "os_saida", ordemServicoId: { in: ordens.map((o) => o.id) } },
      select: { ordemServicoId: true, quantidade: true, custoMedioApos: true },
    }),
    mostrarCusto ? obterCustoMedioCombinadoPorProduto(empresaId) : Promise.resolve(new Map<string, number>()),
  ]);

  const custoRealPorOS = new Map<string, number>();
  for (const mov of movimentacoesOS) {
    if (!mov.ordemServicoId) continue;
    custoRealPorOS.set(
      mov.ordemServicoId,
      (custoRealPorOS.get(mov.ordemServicoId) ?? 0) + Number(mov.quantidade) * Number(mov.custoMedioApos)
    );
  }

  const itensLista: ItemOrdemServico[] = ordens.map((os) => {
    const valorProdutos = os.itensProduto.reduce((acc, i) => acc + Number(i.quantidade) * Number(i.precoUnitario), 0);
    const valorServicos = os.itensServico.reduce((acc, i) => acc + Number(i.quantidade) * Number(i.precoUnitario), 0);
    const total = valorProdutos + valorServicos;

    let margemProdutos: string | undefined;
    let margemTotal: string | undefined;
    if (mostrarCusto) {
      const custoProdutos =
        os.status === "concluida"
          ? (custoRealPorOS.get(os.id) ?? 0)
          : os.itensProduto.reduce(
              (acc, i) => acc + Number(i.quantidade) * (custoMedioPorProduto.get(i.produtoId) ?? 0),
              0
            );
      margemProdutos = formatarMoeda(valorProdutos - custoProdutos);
      margemTotal = formatarMoeda(total - custoProdutos);
    }

    return {
      id: os.id,
      numero: os.numero,
      clienteNome: os.cliente.nome,
      statusLabel: STATUS_LABEL[os.status],
      statusVariant: STATUS_VARIANT[os.status],
      valorServicos: formatarMoeda(valorServicos),
      valorProdutos: formatarMoeda(valorProdutos),
      total: formatarMoeda(total),
      data: os.criadaEm.toLocaleDateString("pt-BR"),
      margemProdutos,
      margemTotal,
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
