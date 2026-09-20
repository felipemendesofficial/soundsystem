import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { criarTaxa } from "../../../actions";
import { TaxaForm } from "../../../taxa-form";

export default async function NovaTaxaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const operadora = await db.operadoraCartao.findFirst({ where: { id, empresaId: session.user.empresaId! } });
  if (!operadora) notFound();

  const bandeiras = await db.bandeira.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova Taxa</h1>
        <p className="text-sm text-muted-foreground">{operadora.descricao}</p>
      </div>
      <TaxaForm
        action={criarTaxa.bind(null, id)}
        cancelarHref={`/operadoras-cartao/${id}`}
        bandeiras={bandeiras.map((b) => ({ id: b.id, nome: b.nome }))}
      />
    </div>
  );
}
