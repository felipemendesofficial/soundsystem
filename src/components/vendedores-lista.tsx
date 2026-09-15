"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";

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
    <div className="space-y-2">
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
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/vendedores/${item.id}`}
                className="relative block rounded-lg border border-border bg-card p-3 active:bg-accent"
              >
                <span
                  className={`absolute top-3.5 right-3 size-2.5 rounded-full ${item.ativo ? "bg-accent" : "bg-muted-foreground/40"}`}
                />
                <h2 className="mb-2 text-[15px] font-semibold">{item.nome}</h2>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Status</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.ativo ? "Ativo" : "Inativo"}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Comissão</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.comissao}</div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
