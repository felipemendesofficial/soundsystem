"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type ItemTabelaPrecoLista = {
  id: string;
  nome: string;
  ativo: boolean;
  quantidadeItens: number;
};

export function TabelasPrecoLista({ itens }: { itens: ItemTabelaPrecoLista[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.nome.toLowerCase().includes(termo)) : itens;

  return (
    <div className="space-y-4">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome"
        aria-label="Buscar Tabela de Preço"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhuma tabela encontrada para "${busca.trim()}".` : "Nenhuma Tabela de Preço cadastrada."}
        </p>
      ) : (
        <ul className="space-y-4">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/tabela-precos/${item.id}`}
                className="relative block rounded-lg border border-border bg-card p-5 active:bg-accent"
              >
                <Badge variant={item.ativo ? "default" : "secondary"} className="absolute top-5 right-5">
                  {item.ativo ? "Ativa" : "Inativa"}
                </Badge>
                <h2 className="mb-2 text-lg font-semibold">{item.nome}</h2>
                <p className="text-[13.5px] text-muted-foreground">
                  {item.quantidadeItens} produto{item.quantidadeItens === 1 ? "" : "s"} precificado
                  {item.quantidadeItens === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
