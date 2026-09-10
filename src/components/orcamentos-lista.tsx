"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type ItemOrcamento = {
  id: string;
  numero: number;
  descricao: string | null;
  statusLabel: string;
  statusVariant: "default" | "secondary" | "destructive";
  valorCompraTotal: string;
  buscaTexto: string;
};

export function OrcamentosLista({ itens }: { itens: ItemOrcamento[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-4">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por número ou descrição"
        aria-label="Buscar Orçamento"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhum orçamento encontrado para "${busca.trim()}".` : "Nenhum Orçamento cadastrado."}
        </p>
      ) : (
        <ul className="space-y-4">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/orcamentos/${item.id}`}
                className="relative block rounded-lg border border-border bg-card p-5 active:bg-accent"
              >
                <Badge variant={item.statusVariant} className="absolute top-5 right-5">
                  {item.statusLabel}
                </Badge>
                <h2 className="mb-4 text-lg font-semibold">Orçamento #{item.numero}</h2>

                <div className="mb-4 grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <div className="mb-1 truncate text-[13px] text-muted-foreground">Descrição</div>
                    <div className="truncate text-[15.5px] font-medium">{item.descricao ?? "-"}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 truncate text-[13px] text-muted-foreground">Valor de Compra</div>
                    <div className="truncate text-[15.5px] font-medium">{item.valorCompraTotal}</div>
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
