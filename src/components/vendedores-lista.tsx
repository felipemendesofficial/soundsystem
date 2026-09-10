"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ItemVendedor = {
  id: string;
  nome: string;
  ativo: boolean;
  comissao: string;
  buscaTexto: string;
};

export function VendedoresLista({ itens }: { itens: ItemVendedor[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-4">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome"
        aria-label="Buscar vendedor"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhum vendedor encontrado para "${busca.trim()}".` : "Nenhum vendedor cadastrado."}
        </p>
      ) : (
        <ul className="space-y-4">
          {filtrados.map((item) => (
            <li key={item.id} className="relative rounded-lg border border-border bg-card p-5">
              <span
                className={`absolute top-5 right-5 size-2.5 rounded-full ${item.ativo ? "bg-accent" : "bg-muted-foreground/40"}`}
              />
              <h2 className="mb-4 text-lg font-semibold">{item.nome}</h2>

              <div className="mb-4 grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <div className="mb-1 truncate text-[13px] text-muted-foreground">Status</div>
                  <div className="truncate text-[15.5px] font-medium">{item.ativo ? "Ativo" : "Inativo"}</div>
                </div>
                <div className="min-w-0">
                  <div className="mb-1 truncate text-[13px] text-muted-foreground">Comissão</div>
                  <div className="truncate text-[15.5px] font-medium">{item.comissao}</div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button render={<Link href={`/vendedores/${item.id}`} />} size="sm">
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
