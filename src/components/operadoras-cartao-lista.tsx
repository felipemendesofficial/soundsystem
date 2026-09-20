"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type ItemOperadoraCartao = {
  id: string;
  descricao: string;
  cnpj: string | null;
  totalTaxas: number;
  ativo: boolean;
  buscaTexto: string;
};

export function OperadorasCartaoLista({ itens }: { itens: ItemOperadoraCartao[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por descrição ou CNPJ"
        aria-label="Buscar operadora"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhuma operadora encontrada para "${busca.trim()}".` : "Nenhuma operadora cadastrada."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/operadoras-cartao/${item.id}`}
                className="relative block rounded-lg border border-border bg-card p-3 active:bg-accent"
              >
                <Badge variant={item.ativo ? "default" : "secondary"} className="absolute top-3 right-3">
                  {item.ativo ? "Ativa" : "Inativa"}
                </Badge>
                <h2 className="mb-1 text-[15px] font-semibold">{item.descricao}</h2>
                {item.cnpj && <div className="text-xs text-muted-foreground">{item.cnpj}</div>}
                <div className="mt-1 text-xs text-muted-foreground">
                  {item.totalTaxas} configuração(ões) de taxa
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
