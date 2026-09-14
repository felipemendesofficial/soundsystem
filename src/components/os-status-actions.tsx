"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
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

  useEffect(() => {
    if (state.erro) toast.error(state.erro);
  }, [state.erro]);

  return (
    <form action={formAction} className="flex-none">
      <Button type="submit" disabled={pending} variant={variant} size="sm" className="whitespace-nowrap">
        {pending ? "Aguarde..." : label}
      </Button>
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
    <>
      {status === "aberta" && <StatusButton action={iniciarAction} label="Iniciar" variant="outline" />}
      <StatusButton action={concluirAction} label="Concluir" />
      <StatusButton action={cancelarAction} label="Cancelar OS" variant="destructive" />
    </>
  );
}
