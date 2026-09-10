import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeLancarMovimentacao, podeVerCusto } from "@/lib/permissions";
import { KardexLista, type ItemKardex } from "@/components/kardex-lista";
import { DepositoFilter } from "@/components/deposito-filter";
import { PeriodoFilter } from "@/components/periodo-filter";
import { EstornarMovimentoButton } from "@/components/estornar-movimento-button";
import { estornarMovimento } from "@/app/(app)/movimentacoes/actions";
import type { Perfil, TipoMovimento } from "@/generated/prisma/client";

const TIPOS_ESTORNAVEIS = new Set<TipoMovimento>([
  "compra",
  "devolucao_cliente",
  "ajuste_entrada",
  "venda",
  "devolucao_fornecedor",
  "perda_avaria",
  "uso_interno",
  "ajuste_saida",
]);

const TIPOS_ENTRADA = new Set<TipoMovimento>([
  "compra",
  "devolucao_cliente",
  "ajuste_entrada",
  "transferencia_entrada",
]);

function podeEstornar(
  m: {
    tipoMovimento: TipoMovimento;
    estornadoEm: Date | null;
    estornoDeId: string | null;
    ordemServicoId: string | null;
    orcamentoId: string | null;
    lancamentoId: string | null;
  },
  perfil: Perfil
) {
  if (!podeLancarMovimentacao(perfil)) return false;
  if (m.estornadoEm || m.estornoDeId) return false;
  if (m.ordemServicoId || m.orcamentoId || m.lancamentoId) return false;
  if (!TIPOS_ESTORNAVEIS.has(m.tipoMovimento)) return false;
  if (perfil === "vendedor" && m.tipoMovimento !== "venda") return false;
  return true;
}

const TIPO_LABEL: Record<string, string> = {
  compra: "Compra",
  devolucao_cliente: "Devolução de Cliente",
  ajuste_entrada: "Ajuste (Entrada)",
  transferencia_entrada: "Transferência (Entrada)",
  venda: "Venda",
  devolucao_fornecedor: "Devolução a Fornecedor",
  perda_avaria: "Perda/Avaria",
  uso_interno: "Uso Interno",
  ajuste_saida: "Ajuste (Saída)",
  transferencia_saida: "Transferência (Saída)",
  os_saida: "Baixa por Ordem de Serviço",
};

function formatarNumero(valor: unknown, casas = 3) {
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function paraISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Intervalo do período em horário local (mesmo critério do resto do app — ex.:
// `intervaloDoDia` em Lançamentos), incluindo o dia final inteiro.
function intervaloPeriodo(inicioISO: string, fimISO: string) {
  const [anoI, mesI, diaI] = inicioISO.split("-").map(Number);
  const [anoF, mesF, diaF] = fimISO.split("-").map(Number);
  return { gte: new Date(anoI, mesI - 1, diaI), lt: new Date(anoF, mesF - 1, diaF + 1) };
}

export default async function KardexPage({
  params,
  searchParams,
}: {
  params: Promise<{ produtoId: string }>;
  searchParams: Promise<{ depositoId?: string; periodo?: string; dataInicio?: string; dataFim?: string }>;
}) {
  const { produtoId } = await params;
  const { depositoId, periodo, dataInicio, dataFim } = await searchParams;

  const hoje = new Date();
  const padraoInicio = paraISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const padraoFim = paraISO(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
  const filtroPeriodo =
    periodo === "todos" ? null : intervaloPeriodo(dataInicio ?? padraoInicio, dataFim ?? padraoFim);

  const session = await auth();
  const perfil = session!.user.perfil;
  const mostrarCusto = podeVerCusto(perfil);

  const [produto, depositos, movimentacoes] = await Promise.all([
    db.produto.findUnique({ where: { id: produtoId }, include: { categoria: true } }),
    db.deposito.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    db.movimentacao.findMany({
      where: {
        produtoId,
        ...(depositoId ? { depositoId } : {}),
        ...(filtroPeriodo ? { dataMovimento: filtroPeriodo } : {}),
      },
      orderBy: { dataMovimento: "asc" },
      include: { deposito: true, cliente: true, fornecedor: true },
    }),
  ]);

  if (!produto) notFound();

  const itensLista: ItemKardex[] = movimentacoes.map((m) => {
    const estornoLabel = [m.estornoDeId && "Estorno", m.estornadoEm && "Estornado"]
      .filter(Boolean)
      .join(" · ");

    let descritivo: string | undefined;
    if (m.tipoMovimento === "compra") descritivo = m.fornecedor?.nome;
    else if (m.tipoMovimento === "venda" || m.tipoMovimento === "os_saida") descritivo = m.cliente?.nome;

    return {
      id: m.id,
      data: new Date(m.dataMovimento).toLocaleString("pt-BR"),
      depositoNome: m.deposito.nome,
      tipoLabel: TIPO_LABEL[m.tipoMovimento],
      isEntrada: TIPOS_ENTRADA.has(m.tipoMovimento),
      descritivo,
      estornoLabel: estornoLabel || undefined,
      quantidade: formatarNumero(m.quantidade),
      saldoQuantidade: formatarNumero(m.saldoQuantidadeApos),
      ...(mostrarCusto
        ? {
            custoUnitario: m.custoUnitario !== null ? formatarMoeda(m.custoUnitario) : "-",
            custoMedioApos: formatarMoeda(m.custoMedioApos),
            saldoValor: formatarMoeda(m.saldoValorApos),
          }
        : {}),
      acao: podeEstornar(m, perfil) ? (
        <EstornarMovimentoButton action={estornarMovimento.bind(null, m.id)} />
      ) : undefined,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Ficha Kardex</h1>
        <p className="text-sm font-medium">
          {produto.sku} · {produto.nome}
        </p>
        <p className="text-xs text-muted-foreground">{produto.categoria.nome}</p>
      </div>

      <DepositoFilter depositos={depositos} />
      <PeriodoFilter padraoInicio={padraoInicio} padraoFim={padraoFim} />

      <KardexLista
        itens={itensLista}
        emptyMessage={
          filtroPeriodo
            ? "Nenhuma movimentação registrada para este produto no período selecionado."
            : "Nenhuma movimentação registrada para este produto."
        }
      />
    </div>
  );
}
