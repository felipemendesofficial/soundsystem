import { criarContaFinanceira } from "../actions";
import { ContaFinanceiraForm } from "../conta-financeira-form";

export default function NovaContaFinanceiraPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Conta Financeira</h1>
      <ContaFinanceiraForm action={criarContaFinanceira} />
    </div>
  );
}
