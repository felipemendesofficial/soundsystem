import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { atualizarTaxa, alternarAtivoTaxa } from "../../../actions";
import { TaxaForm } from "../../../taxa-form";

export default async function EditarTaxaPage({ params }: { params: Promise<{ id: string; taxaId: string }> }) {
  const { id, taxaId } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const operadora = await db.operadoraCartao.findFirst({ where: { id, empresaId: session.user.empresaId! } });
  if (!operadora) notFound();

  const [taxa, bandeiras] = await Promise.all([
    db.operadoraCartaoTaxa.findFirst({ where: { id: taxaId, operadoraId: id } }),
    db.bandeira.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
  ]);
  if (!taxa) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Editar Taxa</h1>
          <p className="text-sm text-muted-foreground">{operadora.descricao}</p>
        </div>
        <Badge variant={taxa.ativo ? "default" : "secondary"}>{taxa.ativo ? "Ativa" : "Inativa"}</Badge>
      </div>

      <TaxaForm
        action={atualizarTaxa.bind(null, id, taxaId)}
        cancelarHref={`/operadoras-cartao/${id}`}
        bandeiras={bandeiras.map((b) => ({ id: b.id, nome: b.nome }))}
        defaultValues={{
          bandeiraId: taxa.bandeiraId,
          modalidade: taxa.modalidade,
          taxaAvista: taxa.taxaAvista.toString(),
          taxaAntecipacao: taxa.taxaAntecipacao.toString(),
          taxaParcEstabelecimento: taxa.taxaParcEstabelecimento.toString(),
          taxaParcCliente: taxa.taxaParcCliente.toString(),
          nDias: String(taxa.nDias),
          tipoRepasse: taxa.tipoRepasse,
        }}
      />

      <form action={alternarAtivoTaxa.bind(null, id, taxaId, !taxa.ativo)}>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className={taxa.ativo ? "border-destructive text-destructive hover:bg-destructive/10" : ""}
        >
          {taxa.ativo ? "Desativar" : "Ativar"}
        </Button>
      </form>
    </div>
  );
}
