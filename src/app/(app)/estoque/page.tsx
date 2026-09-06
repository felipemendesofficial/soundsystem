import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeVerCusto } from "@/lib/permissions";
import { EstoqueLista, type ItemEstoque } from "@/components/estoque-lista";
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

  const itensLista: ItemEstoque[] = itens.map((i) => ({
    id: i.id,
    produtoId: i.produtoId,
    produtoNome: i.produto.nome,
    depositoNome: i.deposito.nome,
    saldo: formatarNumero(i.quantidadeSaldo),
    ...(mostrarCusto
      ? {
          custoMedio: formatarMoeda(i.custoMedioAtual),
          valorTotal: formatarMoeda(i.valorTotalSaldo),
        }
      : {}),
  }));

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

      <EstoqueLista
        itens={itensLista}
        emptyMessage="Nenhum item em estoque para o filtro selecionado."
      />
    </div>
  );
}
