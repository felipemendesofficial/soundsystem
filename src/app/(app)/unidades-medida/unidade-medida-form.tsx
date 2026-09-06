"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UnidadeMedidaFormState } from "./actions";

type Action = (prevState: UnidadeMedidaFormState, formData: FormData) => Promise<UnidadeMedidaFormState>;

export function UnidadeMedidaForm({
  action,
  defaultValues,
}: {
  action: Action;
  defaultValues?: { nome: string };
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} />
      </div>
      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/unidades-medida" />}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
