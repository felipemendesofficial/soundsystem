"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { OrdemServicoFormState } from "@/app/(app)/ordens-servico/actions";

type Action = (prevState: OrdemServicoFormState, formData: FormData) => Promise<OrdemServicoFormState>;

function StatusButton({
  action,
  label,
  variant,
}: {
  action: Action;
  label: string;
  variant?: "default" | "outline" | "destructive";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <Button type="submit" disabled={pending} variant={variant} className="h-11 px-7 text-base">
        {pending ? "Aguarde..." : label}
      </Button>
      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
    </form>
  );
}

export function OSStatusActions({
  status,
  iniciarAction,
  concluirAction,
  cancelarAction,
}: {
  status: "aberta" | "em_andamento" | "concluida" | "cancelada";
  iniciarAction: Action;
  concluirAction: Action;
  cancelarAction: Action;
}) {
  if (status === "concluida" || status === "cancelada") return null;

  return (
    <div className="flex flex-wrap gap-3">
      {status === "aberta" && <StatusButton action={iniciarAction} label="Iniciar" variant="outline" />}
      <StatusButton action={concluirAction} label="Concluir (baixa o estoque)" />
      <StatusButton action={cancelarAction} label="Cancelar OS" variant="destructive" />
    </div>
  );
}
