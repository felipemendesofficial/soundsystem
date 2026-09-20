import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { criarOperadora } from "../actions";
import { OperadoraForm } from "../operadora-form";

export default async function NovaOperadoraPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Operadora de Cartão</h1>
      <OperadoraForm action={criarOperadora} cancelarHref="/operadoras-cartao" />
    </div>
  );
}
