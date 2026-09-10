import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { obterUltimosPrecosVenda } from "@/lib/tabela-preco";
import { MovimentacaoForm } from "./movimentacao-form";

export default async function NovaMovimentacaoPage() {
  const session = await auth();
  const perfil = session!.user.perfil;

  const [produtos, depositos, fornecedores, clientes, vendedores, tabelasPreco, itensTabelaPreco, ultimosPrecos] =
    await Promise.all([
      db.produto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      db.deposito.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      db.fornecedor.findMany({ orderBy: { nome: "asc" } }),
      db.cliente.findMany({ orderBy: { nome: "asc" } }),
      db.vendedor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      db.tabelaPreco.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      db.itemTabelaPreco.findMany(),
      obterUltimosPrecosVenda(),
    ]);

  const precosPorTabela: Record<string, Record<string, number>> = {};
  for (const item of itensTabelaPreco) {
    precosPorTabela[item.tabelaPrecoId] ??= {};
    precosPorTabela[item.tabelaPrecoId][item.produtoId] = Number(item.preco);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Movimentação</h1>
      <MovimentacaoForm
        produtos={produtos.map((p) => ({ id: p.id, label: `${p.nome} — ${p.sku}` }))}
        depositos={depositos.map((d) => ({ id: d.id, label: d.nome }))}
        fornecedores={fornecedores.map((f) => ({ id: f.id, label: f.nome }))}
        clientes={clientes.map((c) => ({ id: c.id, label: c.nome, tabelaPrecoPadraoId: c.tabelaPrecoPadraoId }))}
        vendedores={vendedores.map((v) => ({ id: v.id, label: v.nome }))}
        tabelasPreco={tabelasPreco.map((t) => ({ id: t.id, label: t.nome }))}
        precosPorTabela={precosPorTabela}
        ultimosPrecosVenda={Object.fromEntries(ultimosPrecos)}
        perfil={perfil}
        depositoPadraoId={session!.user.depositoPadraoId}
      />
    </div>
  );
}
