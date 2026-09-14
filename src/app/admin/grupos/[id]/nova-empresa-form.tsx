"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adicionarEmpresa } from "../actions";

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function NovaEmpresaForm({ grupoId }: { grupoId: string }) {
  const [state, formAction, pending] = useActionState(adicionarEmpresa.bind(null, grupoId), {});

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border p-4">
      <h2 className="text-base font-semibold">Adicionar empresa</h2>
      <div className="space-y-2">
        <Label htmlFor="nome" className={labelClass}>Nome da empresa</Label>
        <Input id="nome" name="nome" required className={inputClass} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cnpj" className={labelClass}>CNPJ (opcional)</Label>
        <Input id="cnpj" name="cnpj" className={inputClass} />
      </div>
      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
        {pending ? "Adicionando..." : "Adicionar"}
      </Button>
    </form>
  );
}
