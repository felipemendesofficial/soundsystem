import { criarDeposito } from "../actions";
import { DepositoForm } from "../deposito-form";

export default function NovoDepositoPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo Depósito</h1>
      <DepositoForm action={criarDeposito} />
    </div>
  );
}
