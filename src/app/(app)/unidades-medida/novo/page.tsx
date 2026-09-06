import { criarUnidadeMedida } from "../actions";
import { UnidadeMedidaForm } from "../unidade-medida-form";

export default function NovaUnidadeMedidaPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Unidade de Medida</h1>
      <UnidadeMedidaForm action={criarUnidadeMedida} />
    </div>
  );
}
