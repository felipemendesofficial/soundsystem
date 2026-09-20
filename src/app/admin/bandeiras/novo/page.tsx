import { criarBandeira } from "../actions";
import { BandeiraForm } from "../bandeira-form";

export default function NovaBandeiraPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Bandeira</h1>
      <BandeiraForm action={criarBandeira} />
    </div>
  );
}
