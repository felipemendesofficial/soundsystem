"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
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

  useEffect(() => {
    if (state.erro) toast.error(state.erro);
  }, [state.erro]);

  return (
    <form action={formAction} className="flex-none">
      <Button type="submit" disabled={pending} variant={variant} size="sm" className="whitespace-nowrap">
        {pending ? pendingLabel : label}
      </Button>
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
      <>
        <StatusButton action={finalizarAction} label="Finalizar" pendingLabel="Finalizando..." />
        <StatusButton action={excluirAction} label="Excluir" pendingLabel="Excluindo..." variant="destructive" />
      </>
    );
  }

  if (tipo === "transferencia") return null;

  return (
    <StatusButton
      action={cancelarFechamentoAction}
      label="Cancelar Fechamento"
      pendingLabel="Cancelando..."
      variant="destructive"
    />
  );
}
