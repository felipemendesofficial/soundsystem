import { db } from "@/lib/db";
import { criarContaFinanceira } from "../actions";
import { ContaFinanceiraForm } from "../conta-financeira-form";

export default async function NovaContaFinanceiraPage() {
  const bancos = await db.banco.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Conta Financeira</h1>
      <ContaFinanceiraForm action={criarContaFinanceira} bancos={bancos.map((b) => ({ id: b.id, label: b.nome }))} />
    </div>
  );
}
