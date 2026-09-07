"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ItemFornecedor = {
  id: string;
  nome: string;
  tipo: string;
  documento: string;
  telefone: string;
  buscaTexto: string;
};

export function FornecedoresLista({ itens }: { itens: ItemFornecedor[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-4">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, documento ou telefone"
        aria-label="Buscar fornecedor"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhum fornecedor encontrado para "${busca.trim()}".` : "Nenhum fornecedor cadastrado."}
        </p>
      ) : (
        <ul className="space-y-4">
          {filtrados.map((item) => (
            <li key={item.id} className="relative rounded-lg border border-border bg-card p-5">
              <span className="absolute top-5 right-5 size-2.5 rounded-full bg-accent" />
              <h2 className="mb-4 text-lg font-semibold">{item.nome}</h2>

              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="min-w-0">
                  <div className="mb-1 truncate text-[13px] text-muted-foreground">Tipo</div>
                  <div className="truncate text-[15.5px] font-medium">{item.tipo}</div>
                </div>
                <div className="min-w-0">
                  <div className="mb-1 truncate text-[13px] text-muted-foreground">Documento</div>
                  <div className="truncate text-[15.5px] font-medium">{item.documento}</div>
                </div>
                <div className="min-w-0">
                  <div className="mb-1 truncate text-[13px] text-muted-foreground">Telefone</div>
                  <div className="truncate text-[15.5px] font-medium">{item.telefone}</div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button render={<Link href={`/fornecedores/${item.id}`} />} size="sm">
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
