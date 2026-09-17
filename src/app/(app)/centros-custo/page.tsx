import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { ArvoreHierarquica, type NoArvore } from "@/components/arvore-hierarquica";
import { MascaraPicker } from "@/components/mascara-picker";

export default async function CentrosCustoPage({
  searchParams,
}: {
  searchParams: Promise<{ mascaraId?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const grupoId = session.user.grupoId!;

  const mascaras = await db.mascaraCentroCusto.findMany({
    where: { grupoId },
    orderBy: { nome: "asc" },
  });

  if (mascaras.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Centro de Custo</h1>
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma máscara cadastrada ainda.{" "}
          <Link href="/centros-custo/mascaras/novo" className="font-medium text-primary">
            Criar a primeira
          </Link>
          .
        </p>
      </div>
    );
  }

  const { mascaraId: mascaraIdParam } = await searchParams;
  const mascaraId = mascaras.some((m) => m.id === mascaraIdParam) ? mascaraIdParam! : mascaras[0].id;

  const centros = await db.centroCusto.findMany({
    where: { grupoId, mascaraId },
    orderBy: { codigo: "asc" },
  });

  const itens: NoArvore[] = centros.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    descricao: c.descricao,
    natureza: c.natureza,
    ativo: c.ativo,
    paiId: c.paiId,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Centro de Custo</h1>
        <Link href="/centros-custo/mascaras" className="text-sm font-medium text-primary">
          Configurar máscaras
        </Link>
      </div>

      {mascaras.length > 1 && <MascaraPicker mascaras={mascaras} atual={mascaraId} />}

      <ArvoreHierarquica
        itens={itens}
        caminhoItem="/centros-custo"
        caminhoNovoFilho="/centros-custo/novo"
        hrefNovaRaiz={`/centros-custo/novo?mascaraId=${mascaraId}`}
      />
    </div>
  );
}
