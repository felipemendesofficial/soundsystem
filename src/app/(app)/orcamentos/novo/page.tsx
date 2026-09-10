import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { criarOrcamento } from "../actions";
import { OrcamentoForm } from "@/components/orcamento-form";

export default async function NovoOrcamentoPage() {
  const session = await auth();

  const [depositos, fornecedores, produtos] = await Promise.all([
    db.deposito.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    db.fornecedor.findMany({ orderBy: { nome: "asc" } }),
    db.produto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo Orçamento de Compra</h1>
      <OrcamentoForm
        action={criarOrcamento}
        depositos={depositos.map((d) => ({ id: d.id, label: d.nome }))}
        fornecedores={fornecedores.map((f) => ({ id: f.id, label: f.nome }))}
        produtos={produtos.map((p) => ({ id: p.id, label: `${p.nome} — ${p.sku}` }))}
        depositoPadraoId={session!.user.depositoPadraoId}
      />
    </div>
  );
}
