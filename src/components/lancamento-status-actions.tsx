"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { LancamentoFormState } from "@/app/(app)/lancamentos/actions";

type Action = (prevState: LancamentoFormState, formData: FormData) => Promise<LancamentoFormState>;

function StatusButton({
  action,
  label,
  pendingLabel,
  variant,
}: {
  action: Action;
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline" | "destructive";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <Button type="submit" disabled={pending} variant={variant} className="h-11 px-7 text-base">
        {pending ? pendingLabel : label}
      </Button>
      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
    </form>
  );
}

export function LancamentoStatusActions({
  status,
  tipo,
  finalizarAction,
  cancelarFechamentoAction,
  excluirAction,
}: {
  status: "aberto" | "fechado";
  tipo: string;
  finalizarAction: Action;
  cancelarFechamentoAction: Action;
  excluirAction: Action;
}) {
  if (status === "aberto") {
    return (
      <div className="flex flex-wrap gap-3">
        <StatusButton action={finalizarAction} label="Finalizar (lança no estoque)" pendingLabel="Finalizando..." />
        <StatusButton action={excluirAction} label="Excluir Rascunho" pendingLabel="Excluindo..." variant="destructive" />
      </div>
    );
  }

  if (tipo === "transferencia") return null;

  return (
    <StatusButton
      action={cancelarFechamentoAction}
      label="Cancelar Fechamento (estorna tudo)"
      pendingLabel="Cancelando..."
      variant="destructive"
    />
  );
}
