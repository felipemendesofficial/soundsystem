import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeVerCusto } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function HomePage() {
  const session = await auth();
  const perfil = session!.user.perfil;

  const [totalProdutos, totalDepositos] = await Promise.all([
    db.produto.count({ where: { ativo: true } }),
    db.deposito.count({ where: { ativo: true } }),
  ]);

  let valorTotalEstoque: string | null = null;
  if (podeVerCusto(perfil)) {
    const agregado = await db.produtoEstoque.aggregate({
      _sum: { valorTotalSaldo: true },
    });
    valorTotalEstoque = (agregado._sum.valorTotalSaldo ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  const atalhos = [
    { href: "/movimentacoes/nova", titulo: "Nova Movimentação", descricao: "Registrar entrada ou saída" },
    { href: "/estoque", titulo: "Posição de Estoque", descricao: "Saldo e valor por produto" },
    { href: "/produtos", titulo: "Produtos", descricao: "Cadastro e ficha Kardex" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Olá, {session!.user.name}</h1>
        <p className="text-muted-foreground">Visão geral do estoque</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Produtos ativos</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalProdutos}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Depósitos ativos</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalDepositos}</CardContent>
        </Card>
        {valorTotalEstoque !== null && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Valor total em estoque</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{valorTotalEstoque}</CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {atalhos.map((atalho) => (
          <Link key={atalho.href} href={atalho.href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle>{atalho.titulo}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{atalho.descricao}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
