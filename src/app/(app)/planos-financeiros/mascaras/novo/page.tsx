import { criarMascaraPlanoFinanceiro } from "../actions";
import { MascaraForm } from "@/components/mascara-form";

export default function NovaMascaraPlanoFinanceiroPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Máscara de Plano Financeiro</h1>
      <MascaraForm action={criarMascaraPlanoFinanceiro} cancelarHref="/planos-financeiros/mascaras" />
    </div>
  );
}
