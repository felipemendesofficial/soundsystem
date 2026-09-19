import Link from "next/link";
import { ChevronRight, Plus, ClipboardList, Calculator, Wrench, Wallet } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarOrcamento, podeGerenciarFinanceiro, podeVerCusto } from "@/lib/permissions";
import { obterResumoConciliacao } from "@/lib/conciliacao";
import { obterUltimosPrecosVenda } from "@/lib/tabela-preco";
import { cn } from "@/lib/utils";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Metrica({
  label,
  value,
  highlight,
  negativo,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  negativo?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[9px] uppercase tracking-[0.06em] text-text-faint">{label}</div>
      <div
        className={cn(
          "mt-1 truncate text-[17px] font-normal leading-tight",
          highlight && "font-semibold text-primary",
          negativo && "text-destructive"
        )}
      >
        {value}
      </div>
    </div>
  );
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
        // Venda/os_saida estornada nunca muda de tipoMovimento — só o
        // estorno vira uma linha ajuste_entrada, que já não bate no filtro
        // acima. Sem excluir estornadoEm aqui, a venda original continuava
        // contando de qualquer jeito, sem nada pra compensar.
        estornadoEm: null,
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
        estornadoEm: null,
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

async function obterVisaoGeralEstoque(empresaId: string) {
  const [totalProdutosAgregado, precos] = await Promise.all([
    db.produtoEstoque.groupBy({
      by: ["produtoId"],
      where: { empresaId },
      _sum: { quantidadeSaldo: true, valorTotalSaldo: true },
    }),
    obterUltimosPrecosVenda(empresaId),
  ]);

  let valorTotalCusto = 0;
  let valorTotalVenda = 0;
  for (const item of totalProdutosAgregado) {
    valorTotalCusto += Number(item._sum.valorTotalSaldo ?? 0);
    const precoVenda = precos.get(item.produtoId) ?? 0;
    valorTotalVenda += Number(item._sum.quantidadeSaldo ?? 0) * precoVenda;
  }

  return { valorTotalCusto, valorTotalVenda };
}

/**
 * "Saldo do banco" aqui é a soma de `obterResumoConciliacao` de TODAS as
 * contas da empresa — retrato agregado do momento atual (não filtra por
 * período), mesma fórmula/decisões já usadas na tela de Contas Financeiras
 * (pendência da empresa − pendência do banco, sinais opostos).
 */
async function obterVisaoGeralFinanceira(empresaId: string) {
  const contas = await db.contaFinanceira.findMany({
    where: { empresaId },
    select: { id: true, tipo: true, adiantamentoCliente: true, adiantamentoFornecedor: true, saldoAtual: true },
  });

  let saldoContaCorrente = 0;
  let saldoAdiantamento = 0;
  let saldoCaixa = 0;
  let saldoFundoFixo = 0;
  let saldoAplicacao = 0;
  for (const c of contas) {
    const saldo = Number(c.saldoAtual);
    if (c.tipo === "conta_corrente" && (c.adiantamentoCliente || c.adiantamentoFornecedor)) saldoAdiantamento += saldo;
    else if (c.tipo === "conta_corrente") saldoContaCorrente += saldo;
    else if (c.tipo === "caixa") saldoCaixa += saldo;
    else if (c.tipo === "fundo_fixo") saldoFundoFixo += saldo;
    else if (c.tipo === "aplicacao") saldoAplicacao += saldo;
  }

  const resumosConciliacao = await Promise.all(contas.map((c) => obterResumoConciliacao(c.id, c.saldoAtual)));
  const saldoBancoTotal = resumosConciliacao.reduce((acc, r) => acc + Number(r.saldoBanco), 0);

  const hoje = new Date();
  const [contasAReceber, contasAPagar, receitasVencidas, despesasVencidas] = await Promise.all([
    db.lancamentoFinanceiro.aggregate({
      where: { empresaId, tipo: "receita", status: "aberto", natureza: "real" },
      _sum: { valorOriginal: true },
    }),
    db.lancamentoFinanceiro.aggregate({
      where: { empresaId, tipo: "despesa", status: "aberto", natureza: "real" },
      _sum: { valorOriginal: true },
    }),
    db.lancamentoFinanceiro.aggregate({
      where: { empresaId, tipo: "receita", status: "aberto", natureza: "real", dataVencimento: { lt: hoje } },
      _sum: { valorOriginal: true },
    }),
    db.lancamentoFinanceiro.aggregate({
      where: { empresaId, tipo: "despesa", status: "aberto", natureza: "real", dataVencimento: { lt: hoje } },
      _sum: { valorOriginal: true },
    }),
  ]);

  return {
    saldoContaCorrente,
    saldoAdiantamento,
    saldoCaixa,
    saldoFundoFixo,
    saldoAplicacao,
    saldoBancoTotal,
    contasAReceber: Number(contasAReceber._sum.valorOriginal ?? 0),
    contasAPagar: Number(contasAPagar._sum.valorOriginal ?? 0),
    receitasVencidas: Number(receitasVencidas._sum.valorOriginal ?? 0),
    despesasVencidas: Number(despesasVencidas._sum.valorOriginal ?? 0),
  };
}

export default async function HomePage() {
  const session = await auth();
  const perfil = session!.user.perfil;
  const grupoId = session!.user.grupoId!;
  const empresaId = session!.user.empresaId!;

  const totalProdutos = await db.produto.count({ where: { ativo: true, grupoId } });

  let visaoGeralEstoque: Awaited<ReturnType<typeof obterVisaoGeralEstoque>> | null = null;
  let visaoGeralVendas: Awaited<ReturnType<typeof obterVisaoGeralVendas>> | null = null;
  if (podeVerCusto(perfil)) {
    visaoGeralEstoque = await obterVisaoGeralEstoque(empresaId);
    visaoGeralVendas = await obterVisaoGeralVendas(empresaId);
  }

  const visaoGeralFinanceira = podeGerenciarFinanceiro(perfil) ? await obterVisaoGeralFinanceira(empresaId) : null;

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
    ...(podeGerenciarFinanceiro(perfil)
      ? [
          {
            href: "/lancamentos-financeiros",
            titulo: "Lançamentos Financeiros",
            descricao: "Contas a pagar e a receber",
            icon: Wallet,
          },
        ]
      : []),
  ];

  return (
    <div>
      <div className="pb-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
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

      {visaoGeralEstoque && (
        <>
          <div className="pb-2.5 pt-[22px] font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
            Visão Geral do Estoque
          </div>
          <div className="rounded-[14px] border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              <Metrica label="Produtos ativos" value={String(totalProdutos)} />
              <Metrica label="Valor total em estoque" value={formatarMoeda(visaoGeralEstoque.valorTotalCusto)} />
              <Metrica label="Valor em estoque a preço de venda" value={formatarMoeda(visaoGeralEstoque.valorTotalVenda)} />
            </div>
          </div>
        </>
      )}

      {visaoGeralFinanceira && (
        <>
          <div className="pb-2.5 pt-[22px] font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
            Visão Geral Financeira
          </div>
          <div className="rounded-[14px] border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              <Metrica label="Saldo conta corrente" value={formatarMoeda(visaoGeralFinanceira.saldoContaCorrente)} />
              <Metrica label="Saldo contas adiantamento" value={formatarMoeda(visaoGeralFinanceira.saldoAdiantamento)} />
              <Metrica label="Saldo caixa" value={formatarMoeda(visaoGeralFinanceira.saldoCaixa)} />
              <Metrica label="Saldo fundo fixo" value={formatarMoeda(visaoGeralFinanceira.saldoFundoFixo)} />
              <Metrica label="Saldo contas aplicação" value={formatarMoeda(visaoGeralFinanceira.saldoAplicacao)} />
              <Metrica label="Saldo segundo o banco" value={formatarMoeda(visaoGeralFinanceira.saldoBancoTotal)} highlight />
              <Metrica label="Contas a receber" value={formatarMoeda(visaoGeralFinanceira.contasAReceber)} />
              <Metrica label="Contas a pagar" value={formatarMoeda(visaoGeralFinanceira.contasAPagar)} />
              <Metrica label="Receitas vencidas" value={formatarMoeda(visaoGeralFinanceira.receitasVencidas)} negativo={visaoGeralFinanceira.receitasVencidas > 0} />
              <Metrica label="Despesas vencidas" value={formatarMoeda(visaoGeralFinanceira.despesasVencidas)} negativo={visaoGeralFinanceira.despesasVencidas > 0} />
            </div>
          </div>
        </>
      )}

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
