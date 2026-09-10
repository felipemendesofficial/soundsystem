"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { MovimentacaoFormState } from "@/app/(app)/movimentacoes/actions";

type Action = (prevState: MovimentacaoFormState, formData: FormData) => Promise<MovimentacaoFormState>;

export function EstornarMovimentoButton({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Aguarde..." : "Estornar"}
      </Button>
      {state.erro && <p role="alert" className="text-xs text-destructive">{state.erro}</p>}
    </form>
  );
}
