import { criarAlinea } from "../actions";
import { AlineaForm } from "../alinea-form";

export default function NovaAlineaPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Alínea de Devolução</h1>
      <AlineaForm action={criarAlinea} />
    </div>
  );
}
