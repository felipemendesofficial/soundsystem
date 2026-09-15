import { Wallet } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeVerCusto } from "@/lib/permissions";
import { EstoqueLista, type ItemEstoque } from "@/components/estoque-lista";
import { DepositoFilter } from "@/components/deposito-filter";
import { SaldoFilter } from "@/components/saldo-filter";
import { CategoriaFilter } from "@/components/categoria-filter";
import { Card, CardContent } from "@/components/ui/card";

function formatarNumero(valor: unknown, casas = 3) {
  return Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ depositoId?: string; saldo?: string; categoriaId?: string }>;
}) {
  const { depositoId, saldo, categoriaId } = await searchParams;
  const session = await auth();
  const empresaId = session!.user.empresaId!;
  const grupoId = session!.user.grupoId!;
  const mostrarCusto = podeVerCusto(session!.user.perfil);

  const [depositos, categorias, itens] = await Promise.all([
    db.deposito.findMany({ where: { ativo: true, empresaId }, orderBy: { nome: "asc" } }),
    db.categoria.findMany({ where: { ativo: true, grupoId }, orderBy: { nome: "asc" } }),
    db.produtoEstoque.findMany({
      where: {
        empresaId,
        ...(depositoId ? { depositoId } : {}),
        quantidadeSaldo: saldo === "zero" ? 0 : { gt: 0 },
        ...(categoriaId ? { produto: { categoriaId } } : {}),
      },
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
    buscaTexto: [i.produto.nome, i.produto.sku, i.produto.marca, i.produto.modelo]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
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

      {mostrarCusto && (
        <Card className="bg-primary text-primary-foreground ring-0">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
              <Wallet className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-primary-foreground/70">Valor total (filtro atual)</p>
              <p className="truncate text-xl font-semibold">
                {valorTotalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <DepositoFilter depositos={depositos} />
      <SaldoFilter />
      <CategoriaFilter categorias={categorias} />

      <EstoqueLista
        itens={itensLista}
        emptyMessage="Nenhum item em estoque para o filtro selecionado."
      />
    </div>
  );
}
