"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { OrcamentoFormState } from "@/app/(app)/orcamentos/actions";

type Action = (prevState: OrcamentoFormState, formData: FormData) => Promise<OrcamentoFormState>;

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

export function OrcamentoStatusActions({
  status,
  finalizarAction,
  cancelarFechamentoAction,
}: {
  status: "aberto" | "fechado";
  finalizarAction: Action;
  cancelarFechamentoAction: Action;
}) {
  if (status === "aberto") {
    return (
      <StatusButton
        action={finalizarAction}
        label="Finalizar (lança a compra no estoque)"
        pendingLabel="Finalizando..."
      />
    );
  }

  return (
    <StatusButton
      action={cancelarFechamentoAction}
      label="Cancelar Fechamento (estorna a compra)"
      pendingLabel="Cancelando..."
      variant="destructive"
    />
  );
}
