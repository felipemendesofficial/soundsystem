import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeVerCusto } from "@/lib/permissions";
import { DataTable } from "@/components/data-table";
import { DepositoFilter } from "@/components/deposito-filter";

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
};

function formatarNumero(valor: unknown, casas = 3) {
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function KardexPage({
  params,
  searchParams,
}: {
  params: Promise<{ produtoId: string }>;
  searchParams: Promise<{ depositoId?: string }>;
}) {
  const { produtoId } = await params;
  const { depositoId } = await searchParams;

  const session = await auth();
  const perfil = session!.user.perfil;
  const mostrarCusto = podeVerCusto(perfil);

  const [produto, depositos, movimentacoes] = await Promise.all([
    db.produto.findUnique({ where: { id: produtoId }, include: { categoria: true } }),
    db.deposito.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    db.movimentacao.findMany({
      where: { produtoId, ...(depositoId ? { depositoId } : {}) },
      orderBy: { dataMovimento: "asc" },
      include: { deposito: true },
    }),
  ]);

  if (!produto) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Ficha Kardex — {produto.sku} · {produto.nome}
        </h1>
        <p className="text-muted-foreground">{produto.categoria.nome}</p>
      </div>

      <DepositoFilter depositos={depositos} />

      <DataTable
        rows={movimentacoes}
        getKey={(m) => m.id}
        emptyMessage="Nenhuma movimentação registrada para este produto."
        columns={[
          { header: "Data", cell: (m) => new Date(m.dataMovimento).toLocaleString("pt-BR") },
          { header: "Depósito", cell: (m) => m.deposito.nome },
          { header: "Tipo", cell: (m) => TIPO_LABEL[m.tipoMovimento] },
          { header: "Quantidade", cell: (m) => formatarNumero(m.quantidade) },
          ...(mostrarCusto
            ? [
                {
                  header: "Custo Unitário",
                  cell: (m: (typeof movimentacoes)[number]) =>
                    m.custoUnitario !== null ? formatarMoeda(m.custoUnitario) : "-",
                },
                {
                  header: "Custo Médio Após",
                  cell: (m: (typeof movimentacoes)[number]) => formatarMoeda(m.custoMedioApos),
                },
              ]
            : []),
          { header: "Saldo Qtd.", cell: (m) => formatarNumero(m.saldoQuantidadeApos) },
          ...(mostrarCusto
            ? [
                {
                  header: "Saldo Valor",
                  cell: (m: (typeof movimentacoes)[number]) => formatarMoeda(m.saldoValorApos),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
