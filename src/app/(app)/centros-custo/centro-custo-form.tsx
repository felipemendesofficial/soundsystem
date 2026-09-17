"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CentroCustoFormState } from "./actions";

type Action = (prevState: CentroCustoFormState, formData: FormData) => Promise<CentroCustoFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function CentroCustoForm({
  action,
  cancelarHref,
  prefixo,
  qtdDigitos,
  defaultValues,
}: {
  action: Action;
  cancelarHref: string;
  prefixo?: string | null;
  qtdDigitos?: number;
  defaultValues?: { codigo: string; descricao: string; natureza: string };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const editando = defaultValues !== undefined;

  return (
    <form action={formAction} className="max-w-md space-y-6">
      {editando ? (
        <p className="text-[13px] text-muted-foreground">
          Código <span className="font-mono font-medium text-foreground">{defaultValues.codigo}</span> ·{" "}
          {defaultValues.natureza === "analitica" ? "Analítica" : "Sintética"} — não editáveis.
        </p>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="segmento" className={labelClass}>Código</Label>
          <div className="flex items-center gap-1">
            {prefixo && <span className="font-mono text-base text-muted-foreground">{prefixo}.</span>}
            <Input
              id="segmento"
              name="segmento"
              required
              maxLength={qtdDigitos}
              inputMode="numeric"
              placeholder={qtdDigitos ? "0".repeat(qtdDigitos) : undefined}
              className={`${inputClass} font-mono`}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="descricao" className={labelClass}>Descrição</Label>
        <Input id="descricao" name="descricao" required defaultValue={defaultValues?.descricao} className={inputClass} />
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="outline" render={<Link href={cancelarHref} />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
