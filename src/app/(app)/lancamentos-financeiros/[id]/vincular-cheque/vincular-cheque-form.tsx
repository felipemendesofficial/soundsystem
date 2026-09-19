"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { VincularChequeFormState } from "./actions";

type Action = (prevState: VincularChequeFormState, formData: FormData) => Promise<VincularChequeFormState>;
type Item = { id: string; label: string };

export function VincularChequeForm({
  action,
  cancelarHref,
  cheques,
}: {
  action: Action;
  cancelarHref: string;
  cheques: Item[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const itens = Object.fromEntries(cheques.map((c) => [c.id, c.label]));

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="baixaChequeId" className="text-[15px] font-semibold">Cheque</Label>
        <Select name="baixaChequeId" items={itens}>
          <SelectTrigger id="baixaChequeId" className="h-11 w-full bg-card px-3.5 text-base">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {cheques.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Vinculando..." : "Vincular"}
        </Button>
        <Button type="button" variant="outline" render={<Link href={cancelarHref} />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
