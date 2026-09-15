"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type ItemUnidadeMedida = {
  id: string;
  nome: string;
  ativo: boolean;
};

export function UnidadesMedidaLista({ itens }: { itens: ItemUnidadeMedida[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.nome.toLowerCase().includes(termo)) : itens;

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome"
        aria-label="Buscar unidade de medida"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhuma unidade encontrada para "${busca.trim()}".` : "Nenhuma unidade de medida cadastrada."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/unidades-medida/${item.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 active:bg-accent"
              >
                <h2 className="text-[15px] font-semibold">{item.nome}</h2>
                <Badge variant={item.ativo ? "default" : "secondary"}>{item.ativo ? "Ativo" : "Inativo"}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
