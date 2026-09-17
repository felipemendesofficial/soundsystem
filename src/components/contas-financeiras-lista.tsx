"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type ItemContaFinanceira = {
  id: string;
  nome: string;
  tipoLabel: string;
  banco: string;
  saldoAtual: string;
  ativo: boolean;
  buscaTexto: string;
};

export function ContasFinanceirasLista({ itens }: { itens: ItemContaFinanceira[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome ou banco"
        aria-label="Buscar conta financeira"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhuma conta encontrada para "${busca.trim()}".` : "Nenhuma conta financeira cadastrada."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/contas-financeiras/${item.id}`}
                className="relative block rounded-lg border border-border bg-card p-3 active:bg-accent"
              >
                <Badge variant={item.ativo ? "default" : "secondary"} className="absolute top-3 right-3">
                  {item.ativo ? "Ativa" : "Inativa"}
                </Badge>
                <h2 className="mb-2 text-[15px] font-semibold">{item.nome}</h2>

                <div className="grid grid-cols-3 gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Tipo</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.tipoLabel}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Banco</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.banco}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Saldo</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.saldoAtual}</div>
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
