import Link from "next/link";
import { ChevronRight, Plus, ClipboardList, ListChecks, Package, Wrench } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeVerCusto } from "@/lib/permissions";
import { cn } from "@/lib/utils";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarNumero(valor: number) {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function maiorPor<T>(itens: T[], valor: (item: T) => number): T | null {
  return itens.reduce<T | null>(
    (melhor, item) => (melhor === null || valor(item) > valor(melhor) ? item : melhor),
    null
  );
}

async function obterVisaoGeralVendas() {
  const agora = new Date();
  const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);

  const [movimentosAtuais, movimentosAnteriores] = await Promise.all([
    db.movimentacao.findMany({
      where: { tipoMovimento: { in: ["venda", "os_saida"] }, dataMovimento: { gte: inicioMesAtual } },
      select: {
        produtoId: true,
        quantidade: true,
        precoVenda: true,
        custoMedioApos: true,
        dataMovimento: true,
        ordemServicoId: true,
        usuarioId: true,
        produto: { select: { nome: true } },
      },
    }),
    db.movimentacao.findMany({
      where: {
        tipoMovimento: { in: ["venda", "os_saida"] },
        dataMovimento: { gte: inicioMesAnterior, lt: inicioMesAtual },
      },
      select: { quantidade: true, precoVenda: true },
    }),
  ]);

  let faturamentoAtual = 0;
  let custoTotalAtual = 0;
  const pedidos = new Set<string>();
  const porProduto = new Map<string, { nome: string; quantidade: number; faturamento: number; custo: number }>();

  for (const mov of movimentosAtuais) {
    const quantidade = Number(mov.quantidade);
    const precoVenda = mov.precoVenda ? Number(mov.precoVenda) : 0;
    const custoUnitario = Number(mov.custoMedioApos);
    const faturamentoLinha = quantidade * precoVenda;
    const custoLinha = quantidade * custoUnitario;

    faturamentoAtual += faturamentoLinha;
    custoTotalAtual += custoLinha;
    pedidos.add(mov.ordemServicoId ?? `${mov.dataMovimento.toISOString()}|${mov.usuarioId}`);

    const acumulado = porProduto.get(mov.produtoId) ?? {
      nome: mov.produto.nome,
      quantidade: 0,
      faturamento: 0,
      custo: 0,
    };
    acumulado.quantidade += quantidade;
    acumulado.faturamento += faturamentoLinha;
    acumulado.custo += custoLinha;
    porProduto.set(mov.produtoId, acumulado);
  }

  let faturamentoAnterior = 0;
  for (const mov of movimentosAnteriores) {
    faturamentoAnterior += Number(mov.quantidade) * (mov.precoVenda ? Number(mov.precoVenda) : 0);
  }

  const margemBrutaAtual = faturamentoAtual - custoTotalAtual;
  const margemPercentualAtual = faturamentoAtual > 0 ? (margemBrutaAtual / faturamentoAtual) * 100 : 0;
  const ticketMedio = pedidos.size > 0 ? faturamentoAtual / pedidos.size : 0;
  const variacaoPercentual =
    faturamentoAnterior > 0 ? ((faturamentoAtual - faturamentoAnterior) / faturamentoAnterior) * 100 : null;

  const produtosArray = [...porProduto.values()];
  const maisVendido = maiorPor(produtosArray, (p) => p.quantidade);
  const maiorFaturamento = maiorPor(produtosArray, (p) => p.faturamento);
  const maisRentavel = maiorPor(
    produtosArray.filter((p) => p.faturamento > 0),
    (p) => (p.faturamento - p.custo) / p.faturamento
  );

  return {
    faturamentoAtual,
    margemBrutaAtual,
    margemPercentualAtual,
    ticketMedio,
    variacaoPercentual,
    maisVendido,
    maiorFaturamento,
    maisRentavel,
  };
}

export default async function HomePage() {
  const session = await auth();
  const perfil = session!.user.perfil;

  const totalProdutos = await db.produto.count({ where: { ativo: true } });

  let valorTotalEstoque: string | null = null;
  let visaoGeralVendas: Awaited<ReturnType<typeof obterVisaoGeralVendas>> | null = null;
  if (podeVerCusto(perfil)) {
    const agregado = await db.produtoEstoque.aggregate({
      _sum: { valorTotalSaldo: true },
    });
    valorTotalEstoque = Number(agregado._sum.valorTotalSaldo ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    visaoGeralVendas = await obterVisaoGeralVendas();
  }

  const stats = [
    { label: "Produtos ativos", value: String(totalProdutos), dot: "bg-brand-green" },
    ...(valorTotalEstoque !== null
      ? [{ label: "Valor total em estoque", value: valorTotalEstoque, dot: "bg-primary", warn: true }]
      : []),
  ];

  const atalhos = [
    {
      href: "/movimentacoes/nova",
      titulo: "Nova Movimentação",
      descricao: "Registrar entrada ou saída",
      icon: Plus,
      primary: true,
    },
    {
      href: "/estoque",
      titulo: "Posição de Estoque",
      descricao: "Saldo e valor por produto",
      icon: ClipboardList,
    },
    {
      href: "/ordens-servico/nova",
      titulo: "Nova Ordem de Serviço",
      descricao: "Serviços e produtos usados",
      icon: Wrench,
    },
    {
      href: "/ordens-servico",
      titulo: "Ordens de Serviço",
      descricao: "Acompanhar OS abertas",
      icon: ListChecks,
    },
    {
      href: "/produtos",
      titulo: "Produtos",
      descricao: "Cadastro e ficha Kardex",
      icon: Package,
    },
  ];

  return (
    <div>
      <div>
        <h1 className="font-heading text-[30px] font-extrabold uppercase leading-tight">
          Olá, {session!.user.name}
        </h1>
        <p className="mt-0.5 text-[13.5px] text-muted-foreground">Visão geral do estoque</p>
      </div>

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
            <div
              className={cn(
                "flex size-[42px] flex-none items-center justify-center rounded-[10px] bg-accent text-primary",
                atalho.primary && "bg-brand-yellow text-brand-yellow-foreground"
              )}
            >
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
            <div className="grid grid-cols-3 gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-faint">
                  Faturamento
                </div>
                <div className="mt-1 truncate font-heading text-[17px] font-extrabold leading-tight">
                  {formatarMoeda(visaoGeralVendas.faturamentoAtual)}
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
                  Margem bruta
                </div>
                <div className="mt-1 truncate font-heading text-[17px] font-extrabold leading-tight">
                  {formatarMoeda(visaoGeralVendas.margemBrutaAtual)}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {visaoGeralVendas.margemPercentualAtual.toFixed(0)}%
                </div>
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-faint">
                  Ticket médio
                </div>
                <div className="mt-1 truncate font-heading text-[17px] font-extrabold leading-tight">
                  {formatarMoeda(visaoGeralVendas.ticketMedio)}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2.5 border-t border-border pt-3.5">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="flex-none text-muted-foreground">Mais vendido</span>
                <span className="truncate text-right font-semibold">
                  {visaoGeralVendas.maisVendido
                    ? `${visaoGeralVendas.maisVendido.nome} · ${formatarNumero(visaoGeralVendas.maisVendido.quantidade)}`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="flex-none text-muted-foreground">Maior faturamento</span>
                <span className="truncate text-right font-semibold">
                  {visaoGeralVendas.maiorFaturamento
                    ? `${visaoGeralVendas.maiorFaturamento.nome} · ${formatarMoeda(visaoGeralVendas.maiorFaturamento.faturamento)}`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="flex-none text-muted-foreground">Mais rentável</span>
                <span className="truncate text-right font-semibold">
                  {visaoGeralVendas.maisRentavel
                    ? `${visaoGeralVendas.maisRentavel.nome} · ${(
                        ((visaoGeralVendas.maisRentavel.faturamento - visaoGeralVendas.maisRentavel.custo) /
                          visaoGeralVendas.maisRentavel.faturamento) *
                        100
                      ).toFixed(0)}%`
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
