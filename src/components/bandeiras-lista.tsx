"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type ItemBandeira = {
  id: string;
  nome: string;
  ativo: boolean;
};

export function BandeirasLista({ itens }: { itens: ItemBandeira[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.nome.toLowerCase().includes(termo)) : itens;

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome"
        aria-label="Buscar bandeira"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhuma bandeira encontrada para "${busca.trim()}".` : "Nenhuma bandeira cadastrada."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/admin/bandeiras/${item.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3 active:bg-accent"
              >
                <span className="text-[14px] font-medium">{item.nome}</span>
                <Badge variant={item.ativo ? "default" : "secondary"}>
                  {item.ativo ? "Ativa" : "Inativa"}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
