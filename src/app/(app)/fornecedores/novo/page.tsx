import { criarFornecedor } from "../actions";
import { FornecedorForm } from "../fornecedor-form";

export default function NovoFornecedorPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo Fornecedor</h1>
      <FornecedorForm action={criarFornecedor} />
    </div>
  );
}
