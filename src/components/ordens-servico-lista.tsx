"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type ItemOrdemServico = {
  id: string;
  numero: number;
  clienteNome: string;
  statusLabel: string;
  statusVariant: "default" | "secondary" | "destructive";
  valorServicos: string;
  valorProdutos: string;
  total: string;
  data: string;
  margemProdutos?: string;
  margemTotal?: string;
  buscaTexto: string;
};

export function OrdensServicoLista({ itens }: { itens: ItemOrdemServico[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por número, cliente ou item"
        aria-label="Buscar Ordem de Serviço"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhuma OS encontrada para "${busca.trim()}".` : "Nenhuma Ordem de Serviço cadastrada."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/ordens-servico/${item.id}`}
                className="relative block rounded-lg border border-border bg-card p-3 active:bg-accent"
              >
                <Badge variant={item.statusVariant} className="absolute top-3 right-3">
                  {item.statusLabel}
                </Badge>
                <h2 className="text-[15px] font-semibold">OS #{item.numero}</h2>
                <p className="mb-2 truncate text-[12px] text-muted-foreground">{item.clienteNome}</p>

                <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Serviço</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.valorServicos}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Produtos</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.valorProdutos}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Total</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.total}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Data</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.data}</div>
                  </div>
                  {item.margemProdutos !== undefined && (
                    <div className="min-w-0">
                      <div className="truncate text-[11px] leading-tight text-muted-foreground">Margem Prod.</div>
                      <div className="truncate text-[14px] leading-tight font-medium">{item.margemProdutos}</div>
                    </div>
                  )}
                  {item.margemTotal !== undefined && (
                    <div className="min-w-0">
                      <div className="truncate text-[11px] leading-tight text-muted-foreground">Margem Total</div>
                      <div className="truncate text-[14px] leading-tight font-medium">{item.margemTotal}</div>
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
