"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ConciliacaoFormState } from "./actions";

type Action = (prevState: ConciliacaoFormState, formData: FormData) => Promise<ConciliacaoFormState>;

type Item = { id: string; label: string };

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export function FormPendencia({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-base font-semibold">Lançar pendência</h2>
      <p className="text-xs text-muted-foreground">
        Algo que já apareceu no extrato do banco mas a empresa ainda não lançou no sistema.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="dataPendencia" className={labelClass}>Data</Label>
          <Input id="dataPendencia" name="data" type="date" required defaultValue={hojeISO()} className={inputClass} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="valorPendencia" className={labelClass}>Valor (+ ou −)</Label>
          <Input id="valorPendencia" name="valor" type="number" step="0.01" required className={inputClass} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="comentario" className={labelClass}>Comentário (opcional)</Label>
        <Input id="comentario" name="comentario" className={inputClass} />
      </div>
      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <Button type="submit" disabled={pending} size="sm" variant="outline">{pending ? "Salvando..." : "Lançar pendência"}</Button>
    </form>
  );
}

/** Fecha uma Pendência do banco contra um movimento do sistema — renderizado por linha na lista de Pendências (fora deste arquivo). */
export function FormVincularPendencia({
  action,
  pendenciaId,
  movimentosPendentes,
}: {
  action: Action;
  pendenciaId: string;
  movimentosPendentes: Item[];
}) {
  const [state, formAction, pending] = useActionState(action, {});

  if (movimentosPendentes.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhum movimento pendente pra vincular ainda.</p>;
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="pendenciaId" value={pendenciaId} />
      <Select name="movimentacaoId" items={Object.fromEntries(movimentosPendentes.map((m) => [m.id, m.label]))}>
        <SelectTrigger className="h-9 w-full bg-background text-xs">
          <SelectValue placeholder="Vincular a um movimento do sistema..." />
        </SelectTrigger>
        <SelectContent>
          {movimentosPendentes.map((m) => (
            <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {state.erro && <p role="alert" className="text-xs text-destructive">{state.erro}</p>}
      <Button type="submit" disabled={pending} size="sm" variant="outline">
        {pending ? "Vinculando..." : "Vincular"}
      </Button>
    </form>
  );
}

/** Resolve uma Pendência sem vinculá-la a nenhum movimento — pede a data real em que foi resolvida (não assume hoje). */
export function FormResolverPendencia({ action, pendenciaId }: { action: Action; pendenciaId: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="pendenciaId" value={pendenciaId} />
      <Input
        type="date"
        name="dataResolucao"
        defaultValue={hojeISO()}
        className="h-8 flex-1 text-xs"
        aria-label="Data em que foi resolvida"
      />
      <Button type="submit" disabled={pending} size="sm" variant="ghost" className="h-8 flex-none px-2 text-xs text-muted-foreground underline underline-offset-2">
        {pending ? "Salvando..." : "Resolver sem vincular"}
      </Button>
      {state.erro && <p role="alert" className="text-xs text-destructive">{state.erro}</p>}
    </form>
  );
}

