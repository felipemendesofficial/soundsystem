import { criarVendedor } from "../actions";
import { VendedorForm } from "../vendedor-form";

export default function NovoVendedorPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo Vendedor</h1>
      <VendedorForm action={criarVendedor} />
    </div>
  );
}
