"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ItemRenegociacao = {
  id: string;
  tipo: "receita" | "despesa";
  motivo: string;
  status: "aberta" | "fechada" | "cancelada" | "estornada";
  origens: number;
  destinos: number;
  criadoEmLabel: string;
  criadoEmISO: string;
};

type FiltroStatus = ItemRenegociacao["status"] | "todos";

function formatarISO(ano: number, mes: number, dia: number) {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
function primeiroDiaDoMes() {
  const hoje = new Date();
  return formatarISO(hoje.getFullYear(), hoje.getMonth() + 1, 1);
}
function ultimoDiaDoMes() {
  const hoje = new Date();
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  return formatarISO(hoje.getFullYear(), hoje.getMonth() + 1, ultimoDia);
}

const STATUS_LABEL: Record<ItemRenegociacao["status"], string> = {
  aberta: "Aberta",
  fechada: "Fechada",
  cancelada: "Cancelada",
  estornada: "Estornada",
};

function variantePorStatus(status: ItemRenegociacao["status"]) {
  if (status === "fechada") return "default" as const;
  if (status === "aberta") return "secondary" as const;
  return "outline" as const;
}

export function RenegociacoesLista({ itens }: { itens: ItemRenegociacao[] }) {
  const [statusFiltro, setStatusFiltro] = useState<FiltroStatus>("aberta");
  const [periodoInicio, setPeriodoInicio] = useState(primeiroDiaDoMes);
  const [periodoFim, setPeriodoFim] = useState(ultimoDiaDoMes);

  const filtrados = itens.filter((i) => {
    if (statusFiltro !== "todos" && i.status !== statusFiltro) return false;
    if (periodoInicio && i.criadoEmISO < periodoInicio) return false;
    if (periodoFim && i.criadoEmISO > periodoFim) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1.5">
        {(["aberta", "fechada", "cancelada", "estornada"] as const).map((valor) => (
          <Button
            key={valor}
            type="button"
            size="sm"
            variant={statusFiltro === valor ? "default" : "outline"}
            onClick={() => setStatusFiltro(valor)}
          >
            {STATUS_LABEL[valor]}
          </Button>
        ))}
      </div>
      <Button type="button" size="sm" variant={statusFiltro === "todos" ? "default" : "outline"} className="w-full" onClick={() => setStatusFiltro("todos")}>
        Todas
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} aria-label="De" />
        <Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} aria-label="Até" />
      </div>
      {(periodoInicio || periodoFim) && (
        <button
          type="button"
          onClick={() => {
            setPeriodoInicio("");
            setPeriodoFim("");
          }}
          className="text-xs font-medium text-primary"
        >
          Ver todo o histórico
        </button>
      )}

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma renegociação encontrada para esse filtro.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((r) => (
            <li key={r.id}>
              <Link href={`/renegociacoes/${r.id}`} className="relative block rounded-lg border border-border bg-card p-3 text-sm active:bg-accent">
                <Badge variant={variantePorStatus(r.status)} className="absolute top-3 right-3">
                  {STATUS_LABEL[r.status]}
                </Badge>
                <h2 className="pr-24 font-semibold">{r.motivo}</h2>
                <p className="text-xs text-muted-foreground">
                  {r.criadoEmLabel} · {r.tipo === "despesa" ? "Despesa" : "Receita"} · {r.origens} origem(ns) → {r.destinos} destino(s)
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
