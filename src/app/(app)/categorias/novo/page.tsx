import { criarCategoria } from "../actions";
import { CategoriaForm } from "../categoria-form";

export default function NovaCategoriaPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Categoria</h1>
      <CategoriaForm action={criarCategoria} />
    </div>
  );
}
