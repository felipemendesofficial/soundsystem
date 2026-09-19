"use client";

import { useActionState, useState } from "react";
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

function FormLinhaExtrato({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-base font-semibold">Lançar linha do extrato</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="data" className={labelClass}>Data</Label>
          <Input id="data" name="data" type="date" required defaultValue={hojeISO()} className={inputClass} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="valor" className={labelClass}>Valor (+ ou −)</Label>
          <Input id="valor" name="valor" type="number" step="0.01" required className={inputClass} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="descricao" className={labelClass}>Descrição</Label>
        <Input id="descricao" name="descricao" required className={inputClass} />
      </div>
      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <Button type="submit" disabled={pending} size="sm">{pending ? "Salvando..." : "Adicionar"}</Button>
    </form>
  );
}

function FormConciliar({ action, movimentosPendentes, linhasExtrato }: { action: Action; movimentosPendentes: Item[]; linhasExtrato: Item[] }) {
  const [state, formAction, pending] = useActionState(action, {});
  const itensMov = Object.fromEntries(movimentosPendentes.map((m) => [m.id, m.label]));
  const itensLinhas = Object.fromEntries(linhasExtrato.map((l) => [l.id, l.label]));

  if (movimentosPendentes.length === 0 || linhasExtrato.length === 0) return null;

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-base font-semibold">Conciliar</h2>
      <div className="space-y-1">
        <Label htmlFor="movimentacaoId" className={labelClass}>Movimento do sistema</Label>
        <Select name="movimentacaoId" items={itensMov}>
          <SelectTrigger id="movimentacaoId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {movimentosPendentes.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="extratoLinhaId" className={labelClass}>Linha do extrato</Label>
        <Select name="extratoLinhaId" items={itensLinhas}>
          <SelectTrigger id="extratoLinhaId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {linhasExtrato.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <Button type="submit" disabled={pending} size="sm">{pending ? "Conciliando..." : "Conciliar"}</Button>
    </form>
  );
}

function FormPendencia({ action, linhasExtrato }: { action: Action; linhasExtrato: Item[] }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [extratoLinhaId, setExtratoLinhaId] = useState("");
  const itensLinhas = Object.fromEntries(linhasExtrato.map((l) => [l.id, l.label]));

  if (linhasExtrato.length === 0) return null;

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-base font-semibold">Sem correspondência? Marcar como pendência</h2>
      <div className="space-y-1">
        <Label htmlFor="extratoLinhaIdPendencia" className={labelClass}>Linha do extrato</Label>
        <Select name="extratoLinhaId" value={extratoLinhaId} items={itensLinhas} onValueChange={(v) => setExtratoLinhaId(v ?? "")}>
          <SelectTrigger id="extratoLinhaIdPendencia" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {linhasExtrato.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="comentario" className={labelClass}>Comentário (opcional)</Label>
        <Input id="comentario" name="comentario" className={inputClass} />
      </div>
      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <Button type="submit" disabled={pending} size="sm" variant="outline">{pending ? "Salvando..." : "Marcar como pendência"}</Button>
    </form>
  );
}

export function ConciliacaoForms({
  criarLinhaExtratoAction,
  conciliarAction,
  criarPendenciaAction,
  movimentosPendentes,
  linhasExtrato,
}: {
  contaId: string;
  criarLinhaExtratoAction: Action;
  conciliarAction: Action;
  criarPendenciaAction: Action;
  movimentosPendentes: Item[];
  linhasExtrato: Item[];
}) {
  return (
    <div className="space-y-4">
      <FormLinhaExtrato action={criarLinhaExtratoAction} />
      <FormConciliar action={conciliarAction} movimentosPendentes={movimentosPendentes} linhasExtrato={linhasExtrato} />
      <FormPendencia action={criarPendenciaAction} linhasExtrato={linhasExtrato} />
    </div>
  );
}
