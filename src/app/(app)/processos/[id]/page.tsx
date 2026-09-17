import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArvoreHierarquica, type NoArvore } from "@/components/arvore-hierarquica";
import { alternarAtivoProcesso } from "../actions";

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function ProcessoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const processo = await db.processo.findFirst({
    where: { id, empresaId: session.user.empresaId! },
    include: { mascara: true, itens: { orderBy: { codigo: "asc" } } },
  });
  if (!processo) notFound();

  const itens: NoArvore[] = processo.itens.map((i) => ({
    id: i.id,
    codigo: i.codigo,
    descricao: i.descricao,
    natureza: i.natureza,
    ativo: i.ativo,
    paiId: i.paiId,
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{processo.nome}</h1>
          {processo.padrao && <Badge variant="outline">Padrão</Badge>}
          <Badge variant={processo.ativo ? "default" : "secondary"}>{processo.ativo ? "Ativo" : "Inativo"}</Badge>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {formatarData(processo.dataInicio)} – {formatarData(processo.dataFim)} · Máscara: {processo.mascara.nome}
        </p>
      </div>

      <div className="flex gap-3">
        <Button size="sm" variant="outline" render={<Link href={`/processos/${id}/editar`} />}>
          Editar
        </Button>
        <form action={alternarAtivoProcesso.bind(null, id, !processo.ativo)}>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className={processo.ativo ? "border-destructive text-destructive hover:bg-destructive/10" : ""}
          >
            {processo.ativo ? "Desativar" : "Ativar"}
          </Button>
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Itens</h2>
        <ArvoreHierarquica
          itens={itens}
          caminhoItem={`/processos/${id}/itens`}
          caminhoNovoFilho={`/processos/${id}/itens/novo`}
          hrefNovaRaiz={`/processos/${id}/itens/novo`}
        />
      </div>
    </div>
  );
}
