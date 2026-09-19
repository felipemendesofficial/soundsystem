"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ItemLancamentoFinanceiro = {
  id: string;
  historico: string;
  tipo: "receita" | "despesa";
  status: "aberto" | "baixado" | "estornado" | "cancelado";
  valor: string;
  valorNumerico: number;
  tipoDocumento: string;
  vencimento: string;
  vencimentoISO: string;
  buscaTexto: string;
};

type FiltroTipo = "todos" | "receita" | "despesa";
type FiltroStatus = "aberto" | "fechado" | "todos";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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

const STATUS_LABEL: Record<ItemLancamentoFinanceiro["status"], string> = {
  aberto: "Aberto",
  baixado: "Baixado",
  estornado: "Estornado",
  cancelado: "Cancelado",
};

export function LancamentosFinanceirosLista({ itens }: { itens: ItemLancamentoFinanceiro[] }) {
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<FiltroTipo>("todos");
  const [statusFiltro, setStatusFiltro] = useState<FiltroStatus>("aberto");
  const [periodoInicio, setPeriodoInicio] = useState(primeiroDiaDoMes);
  const [periodoFim, setPeriodoFim] = useState(ultimoDiaDoMes);

  const termo = busca.trim().toLowerCase();
  const filtrados = itens.filter((i) => {
    if (termo && !i.buscaTexto.includes(termo)) return false;
    if (tipoFiltro !== "todos" && i.tipo !== tipoFiltro) return false;
    if (statusFiltro === "aberto" && i.status !== "aberto") return false;
    if (statusFiltro === "fechado" && i.status === "aberto") return false;
    if (periodoInicio && i.vencimentoISO < periodoInicio) return false;
    if (periodoFim && i.vencimentoISO > periodoFim) return false;
    return true;
  });
  const algumFiltroAtivo = itens.length > 0;
  const totalFiltrados = filtrados.reduce((acc, i) => acc + i.valorNumerico, 0);
  const despesasFiltradas = filtrados.filter((i) => i.tipo === "despesa");
  const receitasFiltradas = filtrados.filter((i) => i.tipo === "receita");
  const totalDespesas = despesasFiltradas.reduce((acc, i) => acc + i.valorNumerico, 0);
  const totalReceitas = receitasFiltradas.reduce((acc, i) => acc + i.valorNumerico, 0);

  return (
    <div className="space-y-3">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por histórico, observação, cliente/fornecedor, documento, plano, centro de custo ou processo"
        aria-label="Buscar lançamento financeiro"
      />

      <div className="grid grid-cols-3 gap-2">
        <Button type="button" size="sm" variant={statusFiltro === "aberto" ? "default" : "outline"} onClick={() => setStatusFiltro("aberto")}>
          Aberto
        </Button>
        <Button type="button" size="sm" variant={statusFiltro === "fechado" ? "default" : "outline"} onClick={() => setStatusFiltro("fechado")}>
          Fechado
        </Button>
        <Button type="button" size="sm" variant={statusFiltro === "todos" ? "default" : "outline"} onClick={() => setStatusFiltro("todos")}>
          Todos
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button type="button" size="sm" variant={tipoFiltro === "todos" ? "default" : "outline"} onClick={() => setTipoFiltro("todos")}>
          Todos
        </Button>
        <Button type="button" size="sm" variant={tipoFiltro === "despesa" ? "default" : "outline"} onClick={() => setTipoFiltro("despesa")}>
          Despesa
        </Button>
        <Button type="button" size="sm" variant={tipoFiltro === "receita" ? "default" : "outline"} onClick={() => setTipoFiltro("receita")}>
          Receita
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="periodoInicio" className="text-xs text-muted-foreground">Vencimento de</Label>
          <Input
            id="periodoInicio"
            type="date"
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.target.value)}
            aria-label="Vencimento a partir de"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="periodoFim" className="text-xs text-muted-foreground">até</Label>
          <Input
            id="periodoFim"
            type="date"
            value={periodoFim}
            onChange={(e) => setPeriodoFim(e.target.value)}
            aria-label="Vencimento até"
          />
        </div>
      </div>

      {filtrados.length > 0 && (
        tipoFiltro === "todos" ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <span className="text-muted-foreground">Total Receita ({receitasFiltradas.length})</span>
              <span className="font-semibold">{formatarMoeda(totalReceitas)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <span className="text-muted-foreground">Total Despesa ({despesasFiltradas.length})</span>
              <span className="font-semibold">{formatarMoeda(totalDespesas)}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total ({filtrados.length})</span>
            <span className="font-semibold">{formatarMoeda(totalFiltrados)}</span>
          </div>
        )
      )}

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {algumFiltroAtivo ? "Nenhum lançamento encontrado para os filtros aplicados." : "Nenhum lançamento financeiro cadastrado."}
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
                <div className="grid grid-cols-3 gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Valor</div>
                    <div className={cn("truncate text-[14px] leading-tight font-medium")}>{item.valor}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Vencimento</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.vencimento}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[11px] leading-tight text-muted-foreground">Documento</div>
                    <div className="truncate text-[14px] leading-tight font-medium">{item.tipoDocumento}</div>
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
