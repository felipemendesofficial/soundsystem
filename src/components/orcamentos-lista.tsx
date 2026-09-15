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
  valorVendaTotal: string;
  valorCompraTotal: string;
  taxaRevendaEfetiva: string;
  buscaTexto: string;
};

export function OrcamentosLista({ itens }: { itens: ItemOrcamento[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por número, descrição ou produto"
        aria-label="Buscar Orçamento"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhum orçamento encontrado para "${busca.trim()}".` : "Nenhum Orçamento cadastrado."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/orcamentos/${item.id}`}
                className="relative block rounded-lg border border-border bg-card p-3 active:bg-accent"
              >
                <Badge variant={item.statusVariant} className="absolute top-3 right-3">
                  {item.statusLabel}
                </Badge>
                <h2 className="text-[15px] font-semibold">Orçamento #{item.numero}</h2>
                <p className="mb-2 truncate text-[12px] text-muted-foreground">{item.descricao ?? "Sem descrição"}</p>

                <div className="grid grid-cols-3 gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Venda Estimada</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.valorVendaTotal}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Compra</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.valorCompraTotal}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Taxa Revenda</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.taxaRevendaEfetiva}</div>
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
