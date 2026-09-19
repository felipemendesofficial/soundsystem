"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ConciliarMovimentoState } from "@/app/(app)/contas-financeiras/[id]/conciliacao/actions";

type Action = (prevState: ConciliarMovimentoState, formData: FormData) => Promise<ConciliarMovimentoState>;

export type ItemExtratoConta = {
  id: string;
  tipoLabel: string;
  descricao: string | null;
  dataISO: string;
  dataFormatada: string;
  valorFormatado: string;
  positivo: boolean;
  saldoFormatado: string;
  conciliado: boolean;
  conciliadoEmFormatado: string | null;
};

export function ExtratoContaLista({
  itens,
  conciliarIndividualAction,
  conciliarLoteAction,
  desconciliarAction,
}: {
  itens: ItemExtratoConta[];
  conciliarIndividualAction: Action;
  conciliarLoteAction: Action;
  desconciliarAction: (movimentacaoId: string) => Promise<void>;
}) {
  const [estadoIndividual, formActionIndividual] = useActionState(conciliarIndividualAction, {});
  const [estadoLote, formActionLote, lotePending] = useActionState(conciliarLoteAction, {});
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const pendentes = itens.filter((i) => !i.conciliado);
  const todosSelecionados = pendentes.length > 0 && pendentes.every((i) => selecionados.has(i.id));

  function alternar(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function alternarTodos() {
    setSelecionados(todosSelecionados ? new Set() : new Set(pendentes.map((i) => i.id)));
  }

  const erro = estadoIndividual.erro || estadoLote.erro;

  return (
    <div className="space-y-3">
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}

      {pendentes.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={todosSelecionados}
            onChange={alternarTodos}
            className="size-4 rounded border-border"
          />
          Selecionar todos os pendentes ({pendentes.length})
        </label>
      )}

      <ul className="space-y-2">
        {itens.map((item) => (
          <li key={item.id} className="space-y-2 rounded-lg border border-border bg-card p-3 text-sm">
            <div className="flex items-start gap-2">
              {!item.conciliado && (
                <input
                  type="checkbox"
                  name="movimentacaoIds"
                  value={item.id}
                  form="conciliar-lote-form"
                  checked={selecionados.has(item.id)}
                  onChange={() => alternar(item.id)}
                  className="mt-0.5 size-4 flex-none rounded border-border"
                />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex justify-between">
                  <span className="truncate pr-2 font-medium">{item.tipoLabel}</span>
                  <span className={`flex-none font-medium ${item.positivo ? "text-brand-green" : "text-destructive"}`}>
                    {item.valorFormatado}
                  </span>
                </div>
                {item.descricao && <div className="truncate text-xs text-muted-foreground">{item.descricao}</div>}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{item.dataFormatada}</span>
                  <span>Saldo: {item.saldoFormatado}</span>
                </div>
                {item.conciliado ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-brand-green">
                      Conciliado em {item.conciliadoEmFormatado}
                    </p>
                    <form action={desconciliarAction.bind(null, item.id)}>
                      <button type="submit" className="text-xs font-medium text-destructive">
                        Remover conciliação
                      </button>
                    </form>
                  </div>
                ) : (
                  <form action={formActionIndividual} className="flex items-center gap-2 pt-1">
                    <Input
                      type="date"
                      name={`dataIndividual-${item.id}`}
                      defaultValue={item.dataISO}
                      className="h-8 flex-1 text-xs"
                      aria-label="Data de conciliação"
                    />
                    <Button type="submit" name="movimentacaoId" value={item.id} size="sm" variant="outline" className="h-8 flex-none px-2.5 text-xs">
                      Conciliar
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {pendentes.length > 0 && (
        <form
          id="conciliar-lote-form"
          action={formActionLote}
          className="sticky bottom-[73px] flex items-center gap-2 rounded-lg border border-border bg-card p-3 shadow-sm"
        >
          <Input type="date" name="dataConciliacao" defaultValue={new Date().toISOString().slice(0, 10)} className="h-9 flex-1 text-sm" />
          <Button type="submit" size="sm" disabled={selecionados.size === 0 || lotePending} className="flex-none whitespace-nowrap">
            {lotePending ? "Conciliando..." : `Conciliar (${selecionados.size})`}
          </Button>
        </form>
      )}
    </div>
  );
}
