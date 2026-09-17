"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProcessoFormState } from "./actions";

type Action = (prevState: ProcessoFormState, formData: FormData) => Promise<ProcessoFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function ProcessoForm({
  action,
  cancelarHref,
  mascaras,
  defaultValues,
}: {
  action: Action;
  cancelarHref: string;
  /** Só exibido/exigido ao criar — a máscara de um processo já existente é fixa (a árvore de itens depende dela). */
  mascaras?: { id: string; nome: string }[];
  defaultValues?: { nome: string; dataInicio: string; dataFim: string; padrao: boolean; mascaraNome: string };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const editando = defaultValues !== undefined;

  const itensMascara = Object.fromEntries((mascaras ?? []).map((m) => [m.id, m.nome]));

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="nome" className={labelClass}>Nome</Label>
        <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} className={inputClass} />
      </div>

      {editando ? (
        <p className="text-[13px] text-muted-foreground">
          Máscara: <span className="font-medium text-foreground">{defaultValues.mascaraNome}</span> — não editável.
        </p>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="mascaraId" className={labelClass}>Máscara</Label>
          <Select name="mascaraId" items={itensMascara}>
            <SelectTrigger id="mascaraId" className={`w-full ${inputClass}`}>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {(mascaras ?? []).map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="dataInicio" className={labelClass}>Data de Início</Label>
          <Input id="dataInicio" name="dataInicio" type="date" required defaultValue={defaultValues?.dataInicio} className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dataFim" className={labelClass}>Data de Fim</Label>
          <Input id="dataFim" name="dataFim" type="date" required defaultValue={defaultValues?.dataFim} className={inputClass} />
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
        <Checkbox id="padrao" name="padrao" defaultChecked={defaultValues?.padrao ?? false} />
        <Label htmlFor="padrao" className={labelClass}>Processo padrão da empresa</Label>
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
