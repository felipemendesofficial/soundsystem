import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { MovimentacaoForm } from "./movimentacao-form";

export default async function NovaMovimentacaoPage() {
  const session = await auth();
  const perfil = session!.user.perfil;

  const [produtos, depositos, fornecedores, clientes] = await Promise.all([
    db.produto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    db.deposito.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    db.fornecedor.findMany({ orderBy: { nome: "asc" } }),
    db.cliente.findMany({ orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Movimentação</h1>
      <MovimentacaoForm
        produtos={produtos.map((p) => ({ id: p.id, label: `${p.nome} — ${p.sku}` }))}
        depositos={depositos.map((d) => ({ id: d.id, label: d.nome }))}
        fornecedores={fornecedores.map((f) => ({ id: f.id, label: f.nome }))}
        clientes={clientes.map((c) => ({ id: c.id, label: c.nome }))}
        perfil={perfil}
        depositoPadraoId={session!.user.depositoPadraoId}
      />
    </div>
  );
}
