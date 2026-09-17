"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EstornoFormState } from "../../actions";

type Action = (prevState: EstornoFormState, formData: FormData) => Promise<EstornoFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export function EstornoForm({
  action,
  cancelarHref,
  contas,
  alineas,
}: {
  action: Action;
  cancelarHref: string;
  contas: { id: string; label: string }[];
  alineas: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [dataEstorno] = useState(hojeISO());

  const itensContas = Object.fromEntries(contas.map((c) => [c.id, c.label]));
  const itensAlineas = Object.fromEntries(alineas.map((a) => [a.id, a.label]));

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="contaId" className={labelClass}>Conta</Label>
        <Select name="contaId" items={itensContas}>
          <SelectTrigger id="contaId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {contas.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dataEstorno" className={labelClass}>Data do Estorno</Label>
        <Input id="dataEstorno" name="dataEstorno" type="date" required defaultValue={dataEstorno} className={inputClass} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="motivo" className={labelClass}>Motivo</Label>
        <Input id="motivo" name="motivo" required className={inputClass} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="alineaDevolucaoId" className={labelClass}>Alínea de Devolução (opcional)</Label>
        <Select name="alineaDevolucaoId" items={itensAlineas}>
          <SelectTrigger id="alineaDevolucaoId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Nenhuma" />
          </SelectTrigger>
          <SelectContent>
            {alineas.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Confirmar Estorno"}
        </Button>
        <Button type="button" variant="outline" render={<Link href={cancelarHref} />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
