"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type ItemEstoque = {
  id: string;
  produtoId: string;
  produtoNome: string;
  depositoNome: string;
  saldo: string;
  buscaTexto: string;
  custoMedio?: string;
  valorTotal?: string;
};

export function EstoqueLista({
  itens,
  emptyMessage = "Nenhum item em estoque para o filtro selecionado.",
}: {
  itens: ItemEstoque[];
  emptyMessage?: string;
}) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por descrição, SKU, marca ou modelo..."
          aria-label="Buscar produto"
          className="pl-8"
        />
      </div>

      {itens.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {filtrados.length === itens.length
            ? `${itens.length} ${itens.length === 1 ? "item" : "itens"} em estoque`
            : `${filtrados.length} de ${itens.length} itens`}
        </p>
      )}

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhum produto encontrado para "${busca.trim()}".` : emptyMessage}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => {
            const temCusto = item.custoMedio !== undefined && item.valorTotal !== undefined;
            return (
              <li key={item.id}>
                <Link
                  href={`/kardex/${item.produtoId}`}
                  className="block rounded-lg border border-border bg-card p-3 active:bg-accent"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h2 className="min-w-0 truncate text-[15px] font-semibold">{item.produtoNome}</h2>
                    <Badge variant="secondary" className="shrink-0">
                      {item.depositoNome}
                    </Badge>
                  </div>

                  <div className={`grid gap-x-2 gap-y-1.5 ${temCusto ? "grid-cols-3" : "grid-cols-1"}`}>
                    <div className="min-w-0">
                      <div className="truncate text-[11px] leading-tight text-muted-foreground">Saldo (Qtd.)</div>
                      <div className="truncate text-[14px] leading-tight font-medium">{item.saldo}</div>
                    </div>
                    {temCusto && (
                      <>
                        <div className="min-w-0">
                          <div className="truncate text-[11px] leading-tight text-muted-foreground">Custo Médio</div>
                          <div className="truncate text-[14px] leading-tight font-medium">{item.custoMedio}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[11px] leading-tight text-muted-foreground">Valor Total</div>
                          <div className="truncate text-[14px] leading-tight font-medium">{item.valorTotal}</div>
                        </div>
                      </>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
