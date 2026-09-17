"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type ItemProcesso = {
  id: string;
  nome: string;
  periodo: string;
  padrao: boolean;
  ativo: boolean;
  buscaTexto: string;
};

export function ProcessosLista({ itens }: { itens: ItemProcesso[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome"
        aria-label="Buscar processo"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhum processo encontrado para "${busca.trim()}".` : "Nenhum processo cadastrado."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/processos/${item.id}`}
                className="relative block rounded-lg border border-border bg-card p-3 active:bg-accent"
              >
                <div className="absolute top-3 right-3 flex gap-1.5">
                  {item.padrao && <Badge variant="outline">Padrão</Badge>}
                  <Badge variant={item.ativo ? "default" : "secondary"}>{item.ativo ? "Ativo" : "Inativo"}</Badge>
                </div>
                <h2 className="mb-1 text-[15px] font-semibold">{item.nome}</h2>
                <p className="text-[13px] text-muted-foreground">{item.periodo}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
