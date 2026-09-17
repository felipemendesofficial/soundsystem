"use client";

import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxIcon,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export type ItemRateio = { id: string; label: string };
export type LinhaRateioEditor = { key: string; conta: ItemRateio | null; percentual: string };

let contadorChaveRateio = 0;
export function novaChaveRateio() {
  contadorChaveRateio += 1;
  return `rateio-${contadorChaveRateio}`;
}

export function linhaRateioVazia(): LinhaRateioEditor {
  return { key: novaChaveRateio(), conta: null, percentual: "" };
}

/**
 * Editor de linhas de rateio (conta-folha + percentual) — usado 3x na tela de
 * Lançamento Financeiro: rateio de Plano Financeiro, rateio de Centro de
 * Custo (uma instância por linha de Plano, aninhada), e rateio de Processo.
 * Controlado pelo pai (não guarda o próprio estado) porque o form precisa ler
 * todas as instâncias juntas pra serializar nos hidden inputs no submit.
 */
export function RateioEditor({
  titulo,
  itens,
  linhas,
  onChange,
  exigirSoma100 = true,
  placeholderBusca = "Buscar...",
  vazio = "Nenhuma conta cadastrada.",
}: {
  titulo: string;
  itens: ItemRateio[];
  linhas: LinhaRateioEditor[];
  onChange: (linhas: LinhaRateioEditor[]) => void;
  exigirSoma100?: boolean;
  placeholderBusca?: string;
  vazio?: string;
}) {
  function adicionar() {
    onChange([...linhas, linhaRateioVazia()]);
  }

  function remover(key: string) {
    onChange(linhas.filter((l) => l.key !== key));
  }

  function atualizar(key: string, patch: Partial<LinhaRateioEditor>) {
    onChange(linhas.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const total = linhas.reduce((acc, l) => acc + (Number(l.percentual) || 0), 0);
  const fechado = Math.abs(total - 100) < 0.01;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase">{titulo}</span>
        <button type="button" onClick={adicionar} className="text-sm font-medium text-primary">
          + Linha
        </button>
      </div>

      {itens.length === 0 && linhas.length === 0 ? (
        <p className="text-xs text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="space-y-2">
          {linhas.map((linha) => (
            <li key={linha.key} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Combobox
                  items={itens}
                  value={linha.conta}
                  onValueChange={(item: ItemRateio | null) => atualizar(linha.key, { conta: item })}
                  itemToStringLabel={(item: ItemRateio) => item.label}
                  itemToStringValue={(item: ItemRateio) => item.id}
                >
                  <ComboboxInputGroup>
                    <ComboboxInput placeholder={placeholderBusca} />
                    <ComboboxIcon />
                  </ComboboxInputGroup>
                  <ComboboxContent>
                    <ComboboxEmpty>Nenhum resultado.</ComboboxEmpty>
                    <ComboboxList>
                      {(item: ItemRateio) => (
                        <ComboboxItem key={item.id} value={item}>
                          {item.label}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="%"
                value={linha.percentual}
                onChange={(e) => atualizar(linha.key, { percentual: e.target.value })}
                className="h-9 w-20 flex-none text-center"
                aria-label="Percentual"
              />
              <button
                type="button"
                onClick={() => remover(linha.key)}
                className="flex-none text-destructive"
                aria-label="Remover linha"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {linhas.length > 0 && exigirSoma100 && (
        <p className={cn("text-xs", fechado ? "text-muted-foreground" : "font-medium text-destructive")}>
          Total: {total.toFixed(2)}% {!fechado && "— deve somar 100%"}
        </p>
      )}
    </div>
  );
}
