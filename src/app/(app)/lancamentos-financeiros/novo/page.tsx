import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { criarLancamentoFinanceiro } from "../actions";
import { obterDadosFormularioLancamento } from "../dados-formulario";
import { LancamentoFinanceiroForm } from "../lancamento-financeiro-form";

export default async function NovoLancamentoFinanceiroPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const grupoId = session.user.grupoId!;
  const empresaId = session.user.empresaId!;

  const dados = await obterDadosFormularioLancamento(grupoId, empresaId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo Lançamento Financeiro</h1>
      <LancamentoFinanceiroForm action={criarLancamentoFinanceiro} {...dados} />
    </div>
  );
}
