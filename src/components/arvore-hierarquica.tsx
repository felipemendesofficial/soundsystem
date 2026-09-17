"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type NoArvore = {
  id: string;
  codigo: string;
  descricao: string;
  natureza: "sintetica" | "analitica";
  ativo: boolean;
  paiId: string | null;
};

/**
 * Árvore recursiva compartilhada por Plano Financeiro, Centro de Custo e Item
 * de Processo — mesma lógica de máscara/hierarquia nas 3 famílias (ver
 * CLAUDE.md, módulo financeiro), sem precedente de UI de árvore no app antes
 * disso. Só nós Sintética (agrupador) oferecem "adicionar filho" — um nó
 * Analítica é sempre folha (automático pelo nível da máscara).
 */
export function ArvoreHierarquica({
  itens,
  caminhoItem,
  caminhoNovoFilho,
  hrefNovaRaiz,
}: {
  itens: NoArvore[];
  /** Prefixo do link de edição — o nó vira `${caminhoItem}/${id}`. Recebido como string (não função) porque Client Components não podem receber funções de um Server Component. */
  caminhoItem: string;
  /** Prefixo do link de "adicionar filho" — vira `${caminhoNovoFilho}?paiId=${paiId}`. */
  caminhoNovoFilho: string;
  /** Link já pronto de "adicionar raiz" — cada família monta sua própria query string (mascaraId, etc). */
  hrefNovaRaiz: string;
}) {
  const [busca, setBusca] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(
    () => new Set(itens.filter((i) => i.paiId === null).map((i) => i.id))
  );

  const porPai = useMemo(() => {
    const mapa = new Map<string | null, NoArvore[]>();
    for (const item of itens) {
      const filhos = mapa.get(item.paiId) ?? [];
      filhos.push(item);
      mapa.set(item.paiId, filhos);
    }
    return mapa;
  }, [itens]);

  const porId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);

  const termo = busca.trim().toLowerCase();

  const idsVisiveis = useMemo(() => {
    if (!termo) return null;
    const bateTermo = (item: NoArvore) =>
      item.codigo.toLowerCase().includes(termo) || item.descricao.toLowerCase().includes(termo);

    const visiveis = new Set<string>();
    for (const item of itens) {
      if (!bateTermo(item)) continue;
      let atual: NoArvore | undefined = item;
      while (atual) {
        visiveis.add(atual.id);
        atual = atual.paiId ? porId.get(atual.paiId) : undefined;
      }
    }
    return visiveis;
  }, [itens, termo, porId]);

  function alternarExpandido(id: string) {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function renderNo(no: NoArvore) {
    if (idsVisiveis && !idsVisiveis.has(no.id)) return null;

    const filhos = (porPai.get(no.id) ?? []).filter((f) => !idsVisiveis || idsVisiveis.has(f.id));
    const temFilhos = filhos.length > 0;
    const aberto = termo ? true : expandidos.has(no.id);

    return (
      <li key={no.id}>
        <Collapsible open={temFilhos ? aberto : false} onOpenChange={() => temFilhos && !termo && alternarExpandido(no.id)}>
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card py-2 pr-2 pl-1">
            {temFilhos ? (
              <CollapsibleTrigger className="flex size-6 flex-none items-center justify-center rounded-md active:bg-accent">
                <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", aberto && "rotate-90")} />
              </CollapsibleTrigger>
            ) : (
              <span className="size-6 flex-none" />
            )}

            <Link href={`${caminhoItem}/${no.id}`} className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="flex-none font-mono text-xs text-muted-foreground">{no.codigo}</span>
              <span className="truncate text-[14px] font-medium">{no.descricao}</span>
            </Link>

            {!no.ativo && (
              <Badge variant="secondary" className="flex-none">
                Inativo
              </Badge>
            )}

            {no.natureza === "sintetica" && (
              <Link
                href={`${caminhoNovoFilho}?paiId=${no.id}`}
                className="flex size-6 flex-none items-center justify-center rounded-md text-primary active:bg-accent"
                aria-label={`Adicionar filho em ${no.codigo}`}
              >
                <Plus className="size-4" />
              </Link>
            )}
          </div>

          {temFilhos && (
            <CollapsiblePanel>
              <ul className="mt-1.5 space-y-1.5 border-l border-border pl-3.5">{filhos.map(renderNo)}</ul>
            </CollapsiblePanel>
          )}
        </Collapsible>
      </li>
    );
  }

  const raizes = (porPai.get(null) ?? []).filter((r) => !idsVisiveis || idsVisiveis.has(r.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por código ou descrição"
          aria-label="Buscar na árvore"
        />
        <Link
          href={hrefNovaRaiz}
          className="flex h-8 flex-none items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium active:bg-accent"
        >
          <Plus className="size-4" /> Raiz
        </Link>
      </div>

      {itens.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum registro cadastrado.
        </p>
      ) : raizes.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum resultado para &quot;{busca.trim()}&quot;.
        </p>
      ) : (
        <ul className="space-y-1.5">{raizes.map(renderNo)}</ul>
      )}
    </div>
  );
}
