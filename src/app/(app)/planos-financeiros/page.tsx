import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { ArvoreHierarquica, type NoArvore } from "@/components/arvore-hierarquica";
import { MascaraPicker } from "@/components/mascara-picker";

export default async function PlanosFinanceirosPage({
  searchParams,
}: {
  searchParams: Promise<{ mascaraId?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const grupoId = session.user.grupoId!;

  const mascaras = await db.mascaraPlanoFinanceiro.findMany({
    where: { grupoId },
    orderBy: { nome: "asc" },
  });

  if (mascaras.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Plano Financeiro</h1>
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma máscara cadastrada ainda.{" "}
          <Link href="/planos-financeiros/mascaras/novo" className="font-medium text-primary">
            Criar a primeira
          </Link>
          .
        </p>
      </div>
    );
  }

  const { mascaraId: mascaraIdParam } = await searchParams;
  const mascaraId = mascaras.some((m) => m.id === mascaraIdParam) ? mascaraIdParam! : mascaras[0].id;

  const planos = await db.planoFinanceiro.findMany({
    where: { grupoId, mascaraId },
    orderBy: { codigo: "asc" },
  });

  const itens: NoArvore[] = planos.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    descricao: p.descricao,
    natureza: p.natureza,
    ativo: p.ativo,
    paiId: p.paiId,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Plano Financeiro</h1>
        <Link href="/planos-financeiros/mascaras" className="text-sm font-medium text-primary">
          Configurar máscaras
        </Link>
      </div>

      {mascaras.length > 1 && <MascaraPicker mascaras={mascaras} atual={mascaraId} />}

      <ArvoreHierarquica
        itens={itens}
        caminhoItem="/planos-financeiros"
        caminhoNovoFilho="/planos-financeiros/novo"
        hrefNovaRaiz={`/planos-financeiros/novo?mascaraId=${mascaraId}`}
      />
    </div>
  );
}
