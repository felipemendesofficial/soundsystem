"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ItemOrdemProducao = {
  id: string;
  numero: number;
  produtoFinalNome: string;
  status: "aberta" | "processada" | "cancelada";
  quantidadeEntrada: number;
  depositoEntradaNome: string;
  criadoEmLabel: string;
  criadoEmISO: string;
};

type FiltroStatus = "aberta" | "processada" | "cancelada" | "todos";

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

const STATUS_LABEL: Record<ItemOrdemProducao["status"], string> = {
  aberta: "Aberta",
  processada: "Processada",
  cancelada: "Cancelada",
};

export function OrdensProducaoLista({ itens }: { itens: ItemOrdemProducao[] }) {
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
        {(["aberta", "processada", "cancelada", "todos"] as const).map((valor) => (
          <Button
            key={valor}
            type="button"
            size="sm"
            variant={statusFiltro === valor ? "default" : "outline"}
            onClick={() => setStatusFiltro(valor)}
          >
            {valor === "todos" ? "Todas" : STATUS_LABEL[valor]}
          </Button>
        ))}
      </div>

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
          Nenhuma Ordem de Produção encontrada para esse filtro.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((o) => (
            <li key={o.id}>
              <Link href={`/ordens-producao/${o.id}`} className="relative block rounded-lg border border-border bg-card p-3 text-sm active:bg-accent">
                <Badge
                  variant={o.status === "processada" ? "default" : o.status === "cancelada" ? "outline" : "secondary"}
                  className="absolute top-3 right-3"
                >
                  {STATUS_LABEL[o.status]}
                </Badge>
                <h2 className="pr-24 font-semibold">OP {o.numero} — {o.produtoFinalNome}</h2>
                <p className="text-xs text-muted-foreground">
                  {o.criadoEmLabel} · Qtd {o.quantidadeEntrada} · Entra em {o.depositoEntradaNome}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
