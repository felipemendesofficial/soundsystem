import Link from "next/link";
import { ChevronRight, Plus, ClipboardList, Calculator, Wrench } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarOrcamento, podeVerCusto } from "@/lib/permissions";
import { cn } from "@/lib/utils";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function obterVisaoGeralVendas(empresaId: string) {
  const agora = new Date();
  const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);

  const [movimentosAtuais, movimentosAnteriores, osAtuais, osAnteriores] = await Promise.all([
    db.movimentacao.findMany({
      where: {
        empresaId,
        tipoMovimento: { in: ["venda", "os_saida"] },
        dataMovimento: { gte: inicioMesAtual },
      },
      select: {
        quantidade: true,
        precoVenda: true,
        custoMedioApos: true,
        dataMovimento: true,
        ordemServicoId: true,
        lancamentoId: true,
        usuarioId: true,
      },
    }),
    db.movimentacao.findMany({
      where: {
        empresaId,
        tipoMovimento: { in: ["venda", "os_saida"] },
        dataMovimento: { gte: inicioMesAnterior, lt: inicioMesAtual },
      },
      select: { quantidade: true, precoVenda: true },
    }),
    db.ordemServico.findMany({
      where: { empresaId, status: "concluida", concluidaEm: { gte: inicioMesAtual } },
      select: { id: true, itensServico: { select: { quantidade: true, precoUnitario: true } } },
    }),
    db.ordemServico.findMany({
      where: { empresaId, status: "concluida", concluidaEm: { gte: inicioMesAnterior, lt: inicioMesAtual } },
      select: { itensServico: { select: { quantidade: true, precoUnitario: true } } },
    }),
  ]);

  let valorProdutosAtual = 0;
  let custoProdutosAtual = 0;
  const pedidosProduto = new Set<string>();

  for (const mov of movimentosAtuais) {
    const quantidade = Number(mov.quantidade);
    const precoVenda = mov.precoVenda ? Number(mov.precoVenda) : 0;
    const custoUnitario = Number(mov.custoMedioApos);
    valorProdutosAtual += quantidade * precoVenda;
    custoProdutosAtual += quantidade * custoUnitario;
    pedidosProduto.add(
      mov.lancamentoId ?? mov.ordemServicoId ?? `${mov.dataMovimento.toISOString()}|${mov.usuarioId}`
    );
  }

  let valorProdutosAnterior = 0;
  for (const mov of movimentosAnteriores) {
    valorProdutosAnterior += Number(mov.quantidade) * (mov.precoVenda ? Number(mov.precoVenda) : 0);
  }

  let valorServicosAtual = 0;
  const pedidosServico = new Set<string>();
  for (const os of osAtuais) {
    if (os.itensServico.length === 0) continue;
    pedidosServico.add(os.id);
    for (const item of os.itensServico) {
      valorServicosAtual += Number(item.quantidade) * Number(item.precoUnitario);
    }
  }

  let valorServicosAnterior = 0;
  for (const os of osAnteriores) {
    for (const item of os.itensServico) {
      valorServicosAnterior += Number(item.quantidade) * Number(item.precoUnitario);
    }
  }

  const faturamentoTotalAtual = valorProdutosAtual + valorServicosAtual;
  const faturamentoTotalAnterior = valorProdutosAnterior + valorServicosAnterior;
  const variacaoPercentual =
    faturamentoTotalAnterior > 0
      ? ((faturamentoTotalAtual - faturamentoTotalAnterior) / faturamentoTotalAnterior) * 100
      : null;

  const margemBrutaProdutos = valorProdutosAtual - custoProdutosAtual;
  const margemPercentualProdutos = valorProdutosAtual > 0 ? (margemBrutaProdutos / valorProdutosAtual) * 100 : 0;

  // Serviços não têm custo rastreado no Kardex, então o valor de serviço inteiro
  // entra como margem na margem bruta total (produtos + serviços - custo dos produtos).
  const margemBrutaTotal = faturamentoTotalAtual - custoProdutosAtual;
  const margemPercentualTotal = faturamentoTotalAtual > 0 ? (margemBrutaTotal / faturamentoTotalAtual) * 100 : 0;

  // Composição da margem bruta total entre serviços (100% margem, sem custo
  // rastreado) e produtos — as duas fatias somam ~100% da margem bruta total.
  const percentualServicosNaMargem = margemBrutaTotal > 0 ? (valorServicosAtual / margemBrutaTotal) * 100 : 0;
  const percentualProdutosNaMargem = margemBrutaTotal > 0 ? (margemBrutaProdutos / margemBrutaTotal) * 100 : 0;

  const ticketMedioProduto = pedidosProduto.size > 0 ? valorProdutosAtual / pedidosProduto.size : 0;
  const ticketMedioServico = pedidosServico.size > 0 ? valorServicosAtual / pedidosServico.size : 0;

  const pedidosTotal = new Set(pedidosProduto);
  for (const id of pedidosServico) pedidosTotal.add(id);
  const ticketMedioTotal = pedidosTotal.size > 0 ? faturamentoTotalAtual / pedidosTotal.size : 0;

  return {
    faturamentoTotalAtual,
    variacaoPercentual,
    valorProdutosAtual,
    valorServicosAtual,
    margemBrutaProdutos,
    margemPercentualProdutos,
    margemBrutaTotal,
    margemPercentualTotal,
    percentualServicosNaMargem,
    percentualProdutosNaMargem,
    ticketMedioProduto,
    ticketMedioServico,
    ticketMedioTotal,
  };
}

export default async function HomePage() {
  const session = await auth();
  const perfil = session!.user.perfil;
  const grupoId = session!.user.grupoId!;
  const empresaId = session!.user.empresaId!;

  const totalProdutos = await db.produto.count({ where: { ativo: true, grupoId } });

  let valorTotalEstoque: string | null = null;
  let visaoGeralVendas: Awaited<ReturnType<typeof obterVisaoGeralVendas>> | null = null;
  if (podeVerCusto(perfil)) {
    const agregado = await db.produtoEstoque.aggregate({
      where: { empresaId },
      _sum: { valorTotalSaldo: true },
    });
    valorTotalEstoque = Number(agregado._sum.valorTotalSaldo ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    visaoGeralVendas = await obterVisaoGeralVendas(empresaId);
  }

  const stats = [
    { label: "Produtos ativos", value: String(totalProdutos), dot: "bg-brand-green" },
    ...(valorTotalEstoque !== null
      ? [{ label: "Valor total em estoque", value: valorTotalEstoque, dot: "bg-primary", warn: true }]
      : []),
  ];

  const atalhos = [
    {
      href: "/lancamentos",
      titulo: "Lançamentos",
      descricao: "Movimentações de entrada e saída",
      icon: Plus,
    },
    {
      href: "/estoque",
      titulo: "Posição de Estoque",
      descricao: "Saldo e valor por produto",
      icon: ClipboardList,
    },
    {
      href: "/ordens-servico",
      titulo: "Ordem de Serviço",
      descricao: "Serviços e produtos por cliente",
      icon: Wrench,
    },
    ...(podeGerenciarOrcamento(perfil)
      ? [
          {
            href: "/orcamentos",
            titulo: "Orçamento de Compra",
            descricao: "Rateio de compra por fornecedor",
            icon: Calculator,
          },
        ]
      : []),
  ];

  return (
    <div>
      <h1 className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">Visão geral do estoque</h1>

      <div className="-mx-[18px] mt-[18px] flex gap-2.5 overflow-x-auto px-[18px] pb-1 [scrollbar-width:none]">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="relative w-fit min-w-[140px] flex-none rounded-[14px] border border-border bg-card p-3.5 pb-4"
          >
            <div className={cn("absolute right-2.5 top-2.5 size-2 rounded-full", stat.dot)} />
            <div className="mb-2.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-faint">
              {stat.label}
            </div>
            <div
              className={cn(
                "font-heading text-[32px] font-extrabold leading-none whitespace-nowrap",
                stat.warn && "text-primary"
              )}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="pb-2.5 pt-[22px] font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
        Ações rápidas
      </div>
      <div className="flex flex-col gap-2.5">
        {atalhos.map((atalho) => (
          <Link
            key={atalho.href}
            href={atalho.href}
            className="flex items-center gap-3.5 rounded-[14px] border border-border bg-card p-3.5 active:bg-accent"
          >
            <div className="flex size-[42px] flex-none items-center justify-center rounded-[10px] bg-accent text-primary">
              <atalho.icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-bold">{atalho.titulo}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{atalho.descricao}</div>
            </div>
            <ChevronRight className="size-4 flex-none text-text-faint" />
          </Link>
        ))}
      </div>

      {visaoGeralVendas && (
        <>
          <div className="pb-2.5 pt-[22px] font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
            Visão Geral de Vendas
          </div>
          <div className="rounded-[14px] border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-faint">
                  Faturamento total
                </div>
                <div className="mt-1 truncate text-[17px] font-normal leading-tight">
                  {formatarMoeda(visaoGeralVendas.faturamentoTotalAtual)}
                </div>
                {visaoGeralVendas.variacaoPercentual !== null && (
                  <div
                    className={cn(
                      "mt-0.5 text-[11px] font-semibold",
                      visaoGeralVendas.variacaoPercentual >= 0 ? "text-brand-green" : "text-destructive"
                    )}
                  >
                    {visaoGeralVendas.variacaoPercentual >= 0 ? "↑" : "↓"}
                    {Math.abs(visaoGeralVendas.variacaoPercentual).toFixed(0)}% vs. período anterior
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-faint">
                  Valor dos serviços
                </div>
                <div className="mt-1 truncate text-[17px] font-normal leading-tight">
                  {formatarMoeda(visaoGeralVendas.valorServicosAtual)}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {visaoGeralVendas.percentualServicosNaMargem.toFixed(0)}% da margem bruta
                </div>
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-faint">
                  Valor dos produtos
                </div>
                <div className="mt-1 truncate text-[17px] font-normal leading-tight">
                  {formatarMoeda(visaoGeralVendas.valorProdutosAtual)}
                </div>
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-faint">
                  Margem bruta produtos
                </div>
                <div className="mt-1 truncate text-[17px] font-normal leading-tight">
                  {formatarMoeda(visaoGeralVendas.margemBrutaProdutos)}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {visaoGeralVendas.margemPercentualProdutos.toFixed(0)}% da venda de produtos
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {visaoGeralVendas.percentualProdutosNaMargem.toFixed(0)}% da margem total
                </div>
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-faint">
                  Margem bruta total
                </div>
                <div className="mt-1 truncate text-[17px] font-normal leading-tight">
                  {formatarMoeda(visaoGeralVendas.margemBrutaTotal)}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {visaoGeralVendas.margemPercentualTotal.toFixed(0)}%
                </div>
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-faint">
                  Ticket médio serviço
                </div>
                <div className="mt-1 truncate text-[17px] font-normal leading-tight">
                  {formatarMoeda(visaoGeralVendas.ticketMedioServico)}
                </div>
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-faint">
                  Ticket médio produto
                </div>
                <div className="mt-1 truncate text-[17px] font-normal leading-tight">
                  {formatarMoeda(visaoGeralVendas.ticketMedioProduto)}
                </div>
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-faint">
                  Ticket médio total
                </div>
                <div className="mt-1 truncate text-[17px] font-normal leading-tight">
                  {formatarMoeda(visaoGeralVendas.ticketMedioTotal)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
