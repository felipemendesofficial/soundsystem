import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { obterUltimosPrecosVenda } from "@/lib/tabela-preco";
import { criarOrdemServico } from "../actions";
import { OSForm } from "@/components/os-form";

export default async function NovaOrdemServicoPage() {
  const session = await auth();

  const [clientes, depositos, vendedores, produtos, servicos, tabelasPreco, itensTabelaPreco, ultimosPrecos] =
    await Promise.all([
      db.cliente.findMany({ orderBy: { nome: "asc" } }),
      db.deposito.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      db.vendedor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      db.produto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      db.servico.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
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
      <h1 className="text-2xl font-semibold">Nova Ordem de Serviço</h1>
      <OSForm
        action={criarOrdemServico}
        clientes={clientes.map((c) => ({ id: c.id, label: c.nome, tabelaPrecoPadraoId: c.tabelaPrecoPadraoId }))}
        depositos={depositos.map((d) => ({ id: d.id, label: d.nome }))}
        vendedores={vendedores.map((v) => ({ id: v.id, label: v.nome }))}
        produtos={produtos.map((p) => ({ id: p.id, label: `${p.nome} — ${p.sku}` }))}
        servicos={servicos.map((s) => ({ id: s.id, label: s.nome, precoPadrao: Number(s.precoPadrao) }))}
        tabelasPreco={tabelasPreco.map((t) => ({ id: t.id, label: t.nome }))}
        precosPorTabela={precosPorTabela}
        ultimosPrecosVenda={Object.fromEntries(ultimosPrecos)}
        depositoPadraoId={session!.user.depositoPadraoId}
      />
    </div>
  );
}
