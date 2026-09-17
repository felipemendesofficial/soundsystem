import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { segmentoDoNivel } from "@/lib/mascara";
import { criarCentroCusto } from "../actions";
import { CentroCustoForm } from "../centro-custo-form";

export default async function NovoCentroCustoPage({
  searchParams,
}: {
  searchParams: Promise<{ paiId?: string; mascaraId?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const grupoId = session.user.grupoId!;

  const { paiId, mascaraId: mascaraIdParam } = await searchParams;

  const pai = paiId ? await db.centroCusto.findFirst({ where: { id: paiId, grupoId } }) : null;
  if (paiId && !pai) notFound();
  if (pai && pai.natureza !== "sintetica") redirect(`/centros-custo?mascaraId=${pai.mascaraId}`);

  const mascaraId = pai?.mascaraId ?? mascaraIdParam;
  if (!mascaraId) redirect("/centros-custo");

  const mascara = await db.mascaraCentroCusto.findFirst({
    where: { id: mascaraId, grupoId },
    include: { segmentos: { orderBy: { ordem: "asc" } } },
  });
  if (!mascara) notFound();

  const nivel = (pai?.nivel ?? 0) + 1;
  const segmentoMascara = segmentoDoNivel(mascara.segmentos, nivel);
  if (!segmentoMascara) redirect(`/centros-custo?mascaraId=${mascaraId}`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{pai ? `Novo centro em ${pai.codigo}` : "Novo centro raiz"}</h1>
      <CentroCustoForm
        action={criarCentroCusto.bind(null, paiId ?? null, mascaraId)}
        cancelarHref={`/centros-custo?mascaraId=${mascaraId}`}
        prefixo={pai?.codigo ?? null}
        qtdDigitos={segmentoMascara.qtdDigitos}
      />
    </div>
  );
}
