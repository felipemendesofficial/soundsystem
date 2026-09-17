"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { fecharDiaAction, reabrirDiaAction, type FechamentoFormState } from "./actions";

function BotaoAcao({
  action,
  label,
  labelPendente,
  variant,
}: {
  action: (prevState: FechamentoFormState, formData: FormData) => Promise<FechamentoFormState>;
  label: string;
  labelPendente: string;
  variant?: "outline";
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-2">
      <Button type="submit" disabled={pending} variant={variant}>
        {pending ? labelPendente : label}
      </Button>
      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
    </form>
  );
}

export function FecharDiaBotao({ label }: { label: string }) {
  return <BotaoAcao action={fecharDiaAction} label={label} labelPendente="Fechando..." />;
}

export function ReabrirDiaBotao() {
  return <BotaoAcao action={reabrirDiaAction} label="Reabrir" labelPendente="Reabrindo..." variant="outline" />;
}
