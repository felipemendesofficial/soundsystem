"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ItemLancamentoFinanceiro = {
  id: string;
  historico: string;
  tipo: "receita" | "despesa";
  status: "aberto" | "baixado" | "estornado" | "cancelado";
  valor: string;
  vencimento: string;
  buscaTexto: string;
};

const STATUS_LABEL: Record<ItemLancamentoFinanceiro["status"], string> = {
  aberto: "Aberto",
  baixado: "Baixado",
  estornado: "Estornado",
  cancelado: "Cancelado",
};

export function LancamentosFinanceirosLista({ itens }: { itens: ItemLancamentoFinanceiro[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo ? itens.filter((i) => i.buscaTexto.includes(termo)) : itens;

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por histórico"
        aria-label="Buscar lançamento financeiro"
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {termo ? `Nenhum lançamento encontrado para "${busca.trim()}".` : "Nenhum lançamento financeiro cadastrado."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((item) => (
            <li key={item.id}>
              <Link
                href={`/lancamentos-financeiros/${item.id}`}
                className="relative block rounded-lg border border-border bg-card p-3 active:bg-accent"
              >
                <div className="absolute top-3 right-3 flex gap-1.5">
                  <Badge variant={item.tipo === "receita" ? "default" : "outline"}>
                    {item.tipo === "receita" ? "Receita" : "Despesa"}
                  </Badge>
                  <Badge variant={item.status === "aberto" ? "secondary" : "default"}>{STATUS_LABEL[item.status]}</Badge>
                </div>
                <h2 className="mb-2 max-w-[70%] truncate text-[15px] font-semibold">{item.historico}</h2>
                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Valor</div>
                    <div className={cn("truncate text-[14px] leading-tight font-medium")}>{item.valor}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Vencimento</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.vencimento}</div>
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
