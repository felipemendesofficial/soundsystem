"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AlineaFormState } from "./actions";

type Action = (prevState: AlineaFormState, formData: FormData) => Promise<AlineaFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function AlineaForm({
  action,
  defaultValues,
}: {
  action: Action;
  defaultValues?: { codigo: string; descricao: string };
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="codigo" className={labelClass}>Código</Label>
        <Input id="codigo" name="codigo" required defaultValue={defaultValues?.codigo} className={inputClass} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="descricao" className={labelClass}>Descrição</Label>
        <Input id="descricao" name="descricao" required defaultValue={defaultValues?.descricao} className={inputClass} />
      </div>
      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/admin/alineas-devolucao-cheque" />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
