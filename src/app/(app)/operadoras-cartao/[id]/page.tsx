import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TIPOS_CARTAO_MODALIDADE_LABEL, TIPOS_REPASSE_LABEL } from "@/lib/financeiro-labels";
import { atualizarOperadora, alternarAtivoOperadora } from "../actions";
import { OperadoraForm } from "../operadora-form";

export default async function EditarOperadoraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const operadora = await db.operadoraCartao.findFirst({
    where: { id, empresaId },
    include: { taxas: { include: { bandeira: true }, orderBy: [{ bandeira: { nome: "asc" } }, { modalidade: "asc" }] } },
  });
  if (!operadora) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Editar Operadora</h1>
        <Badge variant={operadora.ativo ? "default" : "secondary"}>
          {operadora.ativo ? "Ativa" : "Inativa"}
        </Badge>
      </div>

      <OperadoraForm
        action={atualizarOperadora.bind(null, id)}
        cancelarHref="/operadoras-cartao"
        defaultValues={{
          descricao: operadora.descricao,
          email: operadora.email,
          cnpj: operadora.cnpj,
          telefoneSuporte: operadora.telefoneSuporte,
          telefoneContato: operadora.telefoneContato,
          telefoneAutorizacao: operadora.telefoneAutorizacao,
          telefoneManutencao: operadora.telefoneManutencao,
          telefoneAntecipacao: operadora.telefoneAntecipacao,
          endereco: operadora.endereco,
          numero: operadora.numero,
          complemento: operadora.complemento,
          bairro: operadora.bairro,
          cidade: operadora.cidade,
          uf: operadora.uf,
          cep: operadora.cep,
          pais: operadora.pais,
          nomePais: operadora.nomePais,
        }}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Taxas por Bandeira e Modalidade</h2>
          <Button size="sm" render={<Link href={`/operadoras-cartao/${id}/taxas/novo`} />}>Nova Taxa</Button>
        </div>

        {operadora.taxas.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma taxa configurada ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {operadora.taxas.map((taxa) => (
              <li key={taxa.id}>
                <Link
                  href={`/operadoras-cartao/${id}/taxas/${taxa.id}`}
                  className="relative block rounded-lg border border-border bg-card p-3 text-sm active:bg-accent"
                >
                  <Badge variant={taxa.ativo ? "default" : "secondary"} className="absolute top-3 right-3">
                    {taxa.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                  <div className="font-semibold">
                    {taxa.bandeira.nome} · {TIPOS_CARTAO_MODALIDADE_LABEL[taxa.modalidade] ?? taxa.modalidade}
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>À vista: {Number(taxa.taxaAvista).toLocaleString("pt-BR")}%</span>
                    <span>Antecipação: {Number(taxa.taxaAntecipacao).toLocaleString("pt-BR")}%</span>
                    <span>Parc. estab.: {Number(taxa.taxaParcEstabelecimento).toLocaleString("pt-BR")}%</span>
                    <span>Parc. cliente: {Number(taxa.taxaParcCliente).toLocaleString("pt-BR")}%</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Repasse: {taxa.nDias} dias · {TIPOS_REPASSE_LABEL[taxa.tipoRepasse] ?? taxa.tipoRepasse}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form action={alternarAtivoOperadora.bind(null, id, !operadora.ativo)}>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className={operadora.ativo ? "border-destructive text-destructive hover:bg-destructive/10" : ""}
        >
          {operadora.ativo ? "Desativar" : "Ativar"}
        </Button>
      </form>
    </div>
  );
}
