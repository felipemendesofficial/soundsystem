import { criarPortador } from "../actions";
import { PortadorForm } from "../portador-form";

export default function NovoPortadorPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo Portador</h1>
      <PortadorForm action={criarPortador} />
    </div>
  );
}
