import { criarCliente } from "../actions";
import { ClienteForm } from "../cliente-form";

export default function NovoClientePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo Cliente</h1>
      <ClienteForm action={criarCliente} />
    </div>
  );
}
