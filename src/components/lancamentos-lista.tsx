"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type ItemLancamento = {
  id: string;
  numero: number;
  tipoLabel: string;
  statusLabel: string;
  statusVariant: "default" | "secondary" | "destructive";
  depositoLabel: string;
  data: string;
  total: string;
  buscaTexto: string;
};

export function LancamentosLista({ itens }: { itens: ItemLancamento[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por número, tipo ou produto"
        aria-label="Buscar Lançamento"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhum lançamento encontrado para "${busca.trim()}".` : "Nenhum lançamento cadastrado."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/lancamentos/${item.id}`}
                className="relative block rounded-lg border border-border bg-card p-3 active:bg-accent"
              >
                <Badge variant={item.statusVariant} className="absolute top-3 right-3">
                  {item.statusLabel}
                </Badge>
                <h2 className="mb-2 text-[15px] font-semibold">Lançamento #{item.numero}</h2>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Tipo</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.tipoLabel}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Depósito</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.depositoLabel}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Data</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.data}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Total</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.total}</div>
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
