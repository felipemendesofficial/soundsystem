import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { criarMovimentoAplicacao } from "../actions";
import { MovimentoAplicacaoForm } from "../movimento-aplicacao-form";

export default async function NovoMovimentoAplicacaoPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const contas = await db.contaFinanceira.findMany({ where: { empresaId, ativo: true }, orderBy: { nome: "asc" } });
  // Caixa e Fundo Fixo nunca aparecem em nenhuma operação de aplicação — só Conta Corrente.
  const contasComuns = contas.filter((c) => c.tipo === "conta_corrente");
  const contasAplicacao = contas.filter((c) => c.tipo === "aplicacao");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Aplicação/Resgate/Rendimento</h1>
      <MovimentoAplicacaoForm
        action={criarMovimentoAplicacao}
        cancelarHref="/aplicacoes-financeiras"
        contasComuns={contasComuns.map((c) => ({ id: c.id, label: c.nome }))}
        contasAplicacao={contasAplicacao.map((c) => ({ id: c.id, label: c.nome }))}
      />
    </div>
  );
}
