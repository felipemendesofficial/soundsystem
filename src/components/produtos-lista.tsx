"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ItemProduto = {
  id: string;
  sku: string;
  nome: string;
  categoria: string;
  marcaModelo: string;
  controlaEstoque: boolean;
  buscaTexto: string;
};

export function ProdutosLista({ itens }: { itens: ItemProduto[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por descrição, categoria, SKU ou marca/modelo"
        aria-label="Buscar produto"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhum produto encontrado para "${busca.trim()}".` : "Nenhum produto cadastrado."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id} className="relative rounded-lg border border-border bg-card p-3">
              <span className="absolute top-3.5 right-3 size-2.5 rounded-full bg-accent" />
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-[15px] font-semibold">{item.nome}</h2>
                {!item.controlaEstoque && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Não controla estoque
                  </span>
                )}
              </div>

              <div className="mb-2 grid grid-cols-3 gap-x-2 gap-y-1.5">
                <div className="min-w-0">
                  <div className="truncate text-[11px] leading-tight text-muted-foreground">SKU</div>
                  <div className="truncate text-[14px] leading-tight font-medium">{item.sku}</div>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[11px] leading-tight text-muted-foreground">Categoria</div>
                  <div className="truncate text-[14px] leading-tight font-medium">{item.categoria}</div>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[11px] leading-tight text-muted-foreground">Marca/Modelo</div>
                  <div className="truncate text-[14px] leading-tight font-medium">{item.marcaModelo}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  render={<Link href={`/kardex/${item.id}`} />}
                  variant="outline"
                  size="sm"
                  className="border-primary text-primary hover:bg-accent hover:text-primary"
                >
                  Histórico
                </Button>
                <Button render={<Link href={`/produtos/${item.id}`} />} size="sm">
                  Editar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
