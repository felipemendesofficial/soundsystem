import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeLancarMovimentacao } from "@/lib/permissions";
import { criarOrdemProducao } from "../actions";
import { OrdemProducaoForm } from "../ordem-producao-form";

export default async function NovaOrdemProducaoPage() {
  const session = await auth();
  if (!session?.user || !podeLancarMovimentacao(session.user.perfil)) redirect("/");
  const grupoId = session.user.grupoId!;
  const empresaId = session.user.empresaId!;

  const [depositos, produtos, servicos] = await Promise.all([
    db.deposito.findMany({ where: { empresaId, ativo: true }, orderBy: { nome: "asc" } }),
    db.produto.findMany({ where: { grupoId, ativo: true }, orderBy: { nome: "asc" } }),
    db.servico.findMany({ where: { grupoId, ativo: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Ordem de Produção</h1>
      <OrdemProducaoForm
        action={criarOrdemProducao}
        depositos={depositos.map((d) => ({ id: d.id, label: d.nome }))}
        produtos={produtos.map((p) => ({ id: p.id, label: `${p.nome} — ${p.sku}` }))}
        servicos={servicos.map((s) => ({ id: s.id, label: s.nome }))}
      />
    </div>
  );
}
