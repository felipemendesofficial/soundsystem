"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";

export type ItemProduto = {
  id: string;
  sku: string;
  nome: string;
  categoria: string;
  marcaModelo: string;
  buscaTexto: string;
};

export function ProdutosLista({ itens }: { itens: ItemProduto[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-3">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por descrição, categoria, SKU ou marca/modelo..."
        aria-label="Buscar produto"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? "Nenhum produto encontrado para a busca." : "Nenhum produto cadastrado."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id} className="rounded-md border p-3">
              <span className="font-medium">{item.nome}</span>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">SKU</dt>
                  <dd className="text-sm">{item.sku}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Categoria</dt>
                  <dd className="text-sm">{item.categoria}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Marca/Modelo</dt>
                  <dd className="text-sm">{item.marcaModelo}</dd>
                </div>
              </dl>
              <div className="mt-2 flex gap-3">
                <Link href={`/kardex/${item.id}`} className="text-sm underline underline-offset-2">
                  Kardex
                </Link>
                <Link href={`/produtos/${item.id}`} className="text-sm underline underline-offset-2">
                  Editar
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
