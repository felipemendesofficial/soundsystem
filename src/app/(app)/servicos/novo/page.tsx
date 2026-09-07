import { criarServico } from "../actions";
import { ServicoForm } from "../servico-form";

export default function NovoServicoPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo Serviço</h1>
      <ServicoForm action={criarServico} />
    </div>
  );
}
