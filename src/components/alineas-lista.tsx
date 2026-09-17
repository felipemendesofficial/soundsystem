"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type ItemAlinea = {
  id: string;
  codigo: string;
  descricao: string;
  ativo: boolean;
  buscaTexto: string;
};

export function AlineasLista({ itens }: { itens: ItemAlinea[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por código ou descrição"
        aria-label="Buscar alínea"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhuma alínea encontrada para "${busca.trim()}".` : "Nenhuma alínea cadastrada."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/admin/alineas-devolucao-cheque/${item.id}`}
                className="relative flex items-start gap-3 rounded-lg border border-border bg-card p-3 active:bg-accent"
              >
                <span className="mt-0.5 flex size-7 flex-none items-center justify-center rounded-full bg-muted text-[12px] font-semibold">
                  {item.codigo}
                </span>
                <span className="min-w-0 flex-1 text-[14px] leading-snug">{item.descricao}</span>
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
