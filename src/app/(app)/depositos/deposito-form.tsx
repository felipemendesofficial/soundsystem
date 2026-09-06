"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DepositoFormState } from "./actions";

type Action = (prevState: DepositoFormState, formData: FormData) => Promise<DepositoFormState>;

export function DepositoForm({
  action,
  defaultValues,
}: {
  action: Action;
  defaultValues?: { nome: string; endereco: string | null };
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="endereco">Endereço</Label>
        <Input id="endereco" name="endereco" defaultValue={defaultValues?.endereco ?? ""} />
      </div>
      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
