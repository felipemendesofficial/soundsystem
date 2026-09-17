import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { segmentoDoNivel } from "@/lib/mascara";
import { criarPlanoFinanceiro } from "../actions";
import { PlanoFinanceiroForm } from "../plano-financeiro-form";

export default async function NovoPlanoFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ paiId?: string; mascaraId?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const grupoId = session.user.grupoId!;

  const { paiId, mascaraId: mascaraIdParam } = await searchParams;

  const pai = paiId ? await db.planoFinanceiro.findFirst({ where: { id: paiId, grupoId } }) : null;
  if (paiId && !pai) notFound();
  if (pai && pai.natureza !== "sintetica") redirect(`/planos-financeiros?mascaraId=${pai.mascaraId}`);

  const mascaraId = pai?.mascaraId ?? mascaraIdParam;
  if (!mascaraId) redirect("/planos-financeiros");

  const mascara = await db.mascaraPlanoFinanceiro.findFirst({
    where: { id: mascaraId, grupoId },
    include: { segmentos: { orderBy: { ordem: "asc" } } },
  });
  if (!mascara) notFound();

  const nivel = (pai?.nivel ?? 0) + 1;
  const segmentoMascara = segmentoDoNivel(mascara.segmentos, nivel);
  if (!segmentoMascara) redirect(`/planos-financeiros?mascaraId=${mascaraId}`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{pai ? `Nova conta em ${pai.codigo}` : "Nova conta raiz"}</h1>
      <PlanoFinanceiroForm
        action={criarPlanoFinanceiro.bind(null, paiId ?? null, mascaraId)}
        cancelarHref={`/planos-financeiros?mascaraId=${mascaraId}`}
        prefixo={pai?.codigo ?? null}
        qtdDigitos={segmentoMascara.qtdDigitos}
      />
    </div>
  );
}
