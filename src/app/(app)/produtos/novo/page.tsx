import { criarProduto } from "../actions";
import { ProdutoForm } from "../produto-form";

export default function NovoProdutoPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo Produto</h1>
      <ProdutoForm action={criarProduto} />
    </div>
  );
}
