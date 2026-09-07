"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DepositoFormState } from "./actions";

type Action = (prevState: DepositoFormState, formData: FormData) => Promise<DepositoFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function DepositoForm({
  action,
  defaultValues,
}: {
  action: Action;
  defaultValues?: { nome: string; endereco: string | null };
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="nome" className={labelClass}>Nome</Label>
        <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} className={inputClass} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="endereco" className={labelClass}>Endereço</Label>
        <Input id="endereco" name="endereco" defaultValue={defaultValues?.endereco ?? ""} className={inputClass} />
      </div>
      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/depositos" />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
