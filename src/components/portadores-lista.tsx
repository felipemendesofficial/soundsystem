"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type ItemPortador = {
  id: string;
  nome: string;
  ativo: boolean;
  buscaTexto: string;
};

export function PortadoresLista({ itens }: { itens: ItemPortador[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome"
        aria-label="Buscar portador"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhum portador encontrado para "${busca.trim()}".` : "Nenhum portador cadastrado."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/portadores/${item.id}`}
                className="relative flex items-center justify-between rounded-lg border border-border bg-card p-3 active:bg-accent"
              >
                <h2 className="text-[15px] font-semibold">{item.nome}</h2>
                <Badge variant={item.ativo ? "default" : "secondary"}>
                  {item.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
