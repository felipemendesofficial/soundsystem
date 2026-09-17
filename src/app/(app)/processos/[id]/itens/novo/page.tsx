import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { segmentoDoNivel } from "@/lib/mascara";
import { criarProcessoItem } from "../../../actions";
import { ProcessoItemForm } from "../processo-item-form";

export default async function NovoProcessoItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paiId?: string }>;
}) {
  const { id: processoId } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const processo = await db.processo.findFirst({
    where: { id: processoId, empresaId: session.user.empresaId! },
    include: { mascara: { include: { segmentos: { orderBy: { ordem: "asc" } } } } },
  });
  if (!processo) notFound();

  const { paiId } = await searchParams;
  const pai = paiId ? await db.processoItem.findFirst({ where: { id: paiId, processoId } }) : null;
  if (paiId && !pai) notFound();
  if (pai && pai.natureza !== "sintetica") redirect(`/processos/${processoId}`);

  const nivel = (pai?.nivel ?? 0) + 1;
  const segmentoMascara = segmentoDoNivel(processo.mascara.segmentos, nivel);
  if (!segmentoMascara) redirect(`/processos/${processoId}`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{pai ? `Novo item em ${pai.codigo}` : "Novo item raiz"}</h1>
      <ProcessoItemForm
        action={criarProcessoItem.bind(null, processoId, paiId ?? null)}
        cancelarHref={`/processos/${processoId}`}
        prefixo={pai?.codigo ?? null}
        qtdDigitos={segmentoMascara.qtdDigitos}
      />
    </div>
  );
}
