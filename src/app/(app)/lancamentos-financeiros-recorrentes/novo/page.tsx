import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { obterDadosFormularioLancamento } from "../../lancamentos-financeiros/dados-formulario";
import { criarLancamentoFinanceiroRecorrente } from "../actions";
import { RecorrenteForm } from "../recorrente-form";

export default async function NovoRecorrentePage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const grupoId = session.user.grupoId!;
  const empresaId = session.user.empresaId!;

  const dados = await obterDadosFormularioLancamento(grupoId, empresaId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo Lançamento Recorrente</h1>
      <RecorrenteForm
        action={criarLancamentoFinanceiroRecorrente}
        clientes={dados.clientes}
        fornecedores={dados.fornecedores}
        contasFinanceiras={dados.contasFinanceiras}
        processos={dados.processos}
        planoFinanceiro={dados.planoFinanceiro}
        centroCusto={dados.centroCusto}
        processoItens={dados.processoItens}
      />
    </div>
  );
}
