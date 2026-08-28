import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeVerCusto } from "@/lib/permissions";
import { DataTable } from "@/components/data-table";
import { DepositoFilter } from "@/components/deposito-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatarNumero(valor: unknown, casas = 3) {
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ depositoId?: string }>;
}) {
  const { depositoId } = await searchParams;
  const session = await auth();
  const mostrarCusto = podeVerCusto(session!.user.perfil);

  const [depositos, itens] = await Promise.all([
    db.deposito.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    db.produtoEstoque.findMany({
      where: { ...(depositoId ? { depositoId } : {}), quantidadeSaldo: { gt: 0 } },
      include: { produto: true, deposito: true },
      orderBy: { produto: { nome: "asc" } },
    }),
  ]);

  const valorTotalGeral = itens.reduce((acc, item) => acc + Number(item.valorTotalSaldo), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Posição de Estoque</h1>

      <div className="flex flex-wrap items-center gap-4">
        <DepositoFilter depositos={depositos} />
        {mostrarCusto && (
          <Card className="w-fit">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">Valor total (filtro atual)</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">
              {valorTotalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </CardContent>
          </Card>
        )}
      </div>

      <DataTable
        rows={itens}
        getKey={(i) => i.id}
        emptyMessage="Nenhum item em estoque para o filtro selecionado."
        columns={[
          { header: "SKU", cell: (i) => i.produto.sku },
          {
            header: "Produto",
            cell: (i) => (
              <Link href={`/kardex/${i.produtoId}`} className="underline underline-offset-2">
                {i.produto.nome}
              </Link>
            ),
          },
          { header: "Depósito", cell: (i) => i.deposito.nome },
          { header: "Saldo (Qtd.)", cell: (i) => formatarNumero(i.quantidadeSaldo) },
          ...(mostrarCusto
            ? [
                {
                  header: "Custo Médio",
                  cell: (i: (typeof itens)[number]) => formatarMoeda(i.custoMedioAtual),
                },
                {
                  header: "Valor Total",
                  cell: (i: (typeof itens)[number]) => formatarMoeda(i.valorTotalSaldo),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
