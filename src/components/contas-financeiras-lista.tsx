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
  saldoSistema: string;
  totalPendencias: string;
  saldoBanco: string;
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
            <li key={item.id} className="rounded-lg border border-border bg-card">
              <Link href={`/contas-financeiras/${item.id}`} className="relative block p-3 active:bg-accent">
                <Badge variant={item.ativo ? "default" : "secondary"} className="absolute top-3 right-3">
                  {item.ativo ? "Ativa" : "Inativa"}
                </Badge>
                <h2 className="mb-2 text-[15px] font-semibold">{item.nome}</h2>

                <div className="mb-2 grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Tipo</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.tipoLabel}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Banco</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.banco}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/50 px-2 py-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-[10.5px] leading-tight text-muted-foreground">Saldo empresa</div>
                    <div className="truncate text-[13px] leading-tight font-medium">{item.saldoSistema}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[10.5px] leading-tight text-muted-foreground">Pendências</div>
                    <div className="truncate text-[13px] leading-tight font-medium">{item.totalPendencias}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[10.5px] leading-tight text-muted-foreground">Saldo banco</div>
                    <div className="truncate text-[13px] leading-tight font-medium">{item.saldoBanco}</div>
                  </div>
                </div>
              </Link>
              <div className="grid grid-cols-2 divide-x divide-border border-t border-border text-sm font-medium text-primary">
                <Link href={`/contas-financeiras/${item.id}/extrato`} className="block px-3 py-2 text-center active:bg-accent">
                  Extrato
                </Link>
                <Link href={`/contas-financeiras/${item.id}/conciliacao`} className="block px-3 py-2 text-center active:bg-accent">
                  Conciliação Bancária
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
