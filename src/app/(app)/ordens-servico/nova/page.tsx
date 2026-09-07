import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { criarOrdemServico } from "../actions";
import { OSForm } from "@/components/os-form";

export default async function NovaOrdemServicoPage() {
  const session = await auth();

  const [clientes, depositos, produtos, servicos] = await Promise.all([
    db.cliente.findMany({ orderBy: { nome: "asc" } }),
    db.deposito.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    db.produto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    db.servico.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Ordem de Serviço</h1>
      <OSForm
        action={criarOrdemServico}
        clientes={clientes.map((c) => ({ id: c.id, label: c.nome }))}
        depositos={depositos.map((d) => ({ id: d.id, label: d.nome }))}
        produtos={produtos.map((p) => ({ id: p.id, label: `${p.nome} — ${p.sku}` }))}
        servicos={servicos.map((s) => ({ id: s.id, label: s.nome, precoPadrao: Number(s.precoPadrao) }))}
        depositoPadraoId={session!.user.depositoPadraoId}
      />
    </div>
  );
}
