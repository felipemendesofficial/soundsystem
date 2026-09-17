import { criarMascaraProcesso } from "../actions";
import { MascaraForm } from "@/components/mascara-form";

export default function NovaMascaraProcessoPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Máscara de Processo</h1>
      <MascaraForm action={criarMascaraProcesso} cancelarHref="/processos/mascaras" />
    </div>
  );
}
