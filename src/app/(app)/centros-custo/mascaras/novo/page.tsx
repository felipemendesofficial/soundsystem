import { criarMascaraCentroCusto } from "../actions";
import { MascaraForm } from "@/components/mascara-form";

export default function NovaMascaraCentroCustoPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Máscara de Centro de Custo</h1>
      <MascaraForm action={criarMascaraCentroCusto} cancelarHref="/centros-custo/mascaras" />
    </div>
  );
}
