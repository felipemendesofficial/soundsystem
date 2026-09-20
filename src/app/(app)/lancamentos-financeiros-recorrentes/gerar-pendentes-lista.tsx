"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { gerarPendente, gerarTodosPendentesComValorConhecido } from "./actions";

export type ItemPendente = {
  recorrenteId: string;
  descricao: string;
  proximaOcorrencia: string;
  valorSugerido: string | null;
};

function LinhaPendente({ item }: { item: ItemPendente }) {
  const [state, formAction, pending] = useActionState(gerarPendente.bind(null, item.recorrenteId), {});

  return (
    <li className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[15px] font-semibold">{item.descricao}</div>
          <div className="text-xs text-muted-foreground">Vencimento: {item.proximaOcorrencia}</div>
        </div>
      </div>
      <form action={formAction} className="flex items-center gap-2">
        <Input
          name="valor"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="Valor (R$)"
          defaultValue={item.valorSugerido ?? ""}
          className="h-10 bg-background"
        />
        <Button type="submit" size="sm" disabled={pending} className="flex-none">
          {pending ? "Gerando..." : "Gerar"}
        </Button>
      </form>
      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
    </li>
  );
}

function BotaoGerarTodos() {
  const [state, formAction, pending] = useActionState(gerarTodosPendentesComValorConhecido, {});

  useEffect(() => {
    if (state.gerados !== undefined) toast.success(`${state.gerados} lançamento(s) gerado(s).`);
    if (state.erro) toast.error(state.erro);
  }, [state]);

  return (
    <form action={formAction}>
      <Button type="submit" variant="outline" className="w-full" disabled={pending}>
        {pending ? "Gerando..." : "Gerar todos os que já têm valor sugerido"}
      </Button>
    </form>
  );
}

export function GerarPendentesLista({ itens }: { itens: ItemPendente[] }) {
  if (itens.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum recorrente pendente no momento.
      </p>
    );
  }

  const algumComSugestao = itens.some((i) => i.valorSugerido !== null);

  return (
    <div className="space-y-3">
      {algumComSugestao && <BotaoGerarTodos />}
      <ul className="space-y-2">
        {itens.map((item) => (
          <LinhaPendente key={item.recorrenteId} item={item} />
        ))}
      </ul>
    </div>
  );
}
