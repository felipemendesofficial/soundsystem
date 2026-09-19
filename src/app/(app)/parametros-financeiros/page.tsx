import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { ParametroForm } from "./parametro-form";

export default async function ParametrosFinanceirosPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;
  const grupoId = session.user.grupoId!;

  const [parametro, planos] = await Promise.all([
    db.parametroFinanceiro.findUnique({ where: { empresaId } }),
    db.planoFinanceiro.findMany({ where: { grupoId, natureza: "analitica", ativo: true }, orderBy: { codigo: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Parâmetros Financeiros</h1>
      <ParametroForm
        planos={planos.map((p) => ({ id: p.id, label: `${p.codigo} — ${p.descricao}` }))}
        defaultValues={{
          planoAplicacaoId: parametro?.planoAplicacaoId ?? null,
          planoResgateId: parametro?.planoResgateId ?? null,
          planoRendimentoId: parametro?.planoRendimentoId ?? null,
          percentualMultaPadrao: parametro?.percentualMultaPadrao?.toString() ?? null,
        }}
      />
    </div>
  );
}
