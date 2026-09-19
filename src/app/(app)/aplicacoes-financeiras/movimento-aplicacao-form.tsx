"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MovimentoAplicacaoFormState } from "./actions";

type Action = (prevState: MovimentoAplicacaoFormState, formData: FormData) => Promise<MovimentoAplicacaoFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

const TIPOS: Record<string, string> = {
  aplicacao_financeira: "Aplicação Financeira",
  resgate_aplicacao: "Resgate de Aplicação",
  registro_rendimento: "Registro de Rendimento",
};

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export function MovimentoAplicacaoForm({
  action,
  cancelarHref,
  contasComuns,
  contasAplicacao,
}: {
  action: Action;
  cancelarHref: string;
  contasComuns: { id: string; label: string }[];
  contasAplicacao: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [tipoMovimento, setTipoMovimento] = useState("aplicacao_financeira");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());

  const itensComuns = Object.fromEntries(contasComuns.map((c) => [c.id, c.label]));
  const itensAplicacao = Object.fromEntries(contasAplicacao.map((c) => [c.id, c.label]));

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="tipoMovimento" className={labelClass}>Tipo</Label>
        <Select name="tipoMovimento" value={tipoMovimento} items={TIPOS} onValueChange={(v) => v && setTipoMovimento(v)}>
          <SelectTrigger id="tipoMovimento" className={`w-full ${inputClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TIPOS).map(([valor, rotulo]) => (
              <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tipoMovimento !== "registro_rendimento" && (
        <div className="space-y-2">
          <Label htmlFor="daContaId" className={labelClass}>
            {tipoMovimento === "aplicacao_financeira" ? "Conta de Origem" : "Conta de Aplicação (resgatar de)"}
          </Label>
          <Select name="daContaId" items={tipoMovimento === "aplicacao_financeira" ? itensComuns : itensAplicacao}>
            <SelectTrigger id="daContaId" className={`w-full ${inputClass}`}>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {(tipoMovimento === "aplicacao_financeira" ? contasComuns : contasAplicacao).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="paraContaId" className={labelClass}>
          {tipoMovimento === "resgate_aplicacao" ? "Conta de destino" : "Conta de Aplicação"}
        </Label>
        <Select name="paraContaId" items={tipoMovimento === "resgate_aplicacao" ? itensComuns : itensAplicacao}>
          <SelectTrigger id="paraContaId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {(tipoMovimento === "resgate_aplicacao" ? contasComuns : contasAplicacao).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="valor" className={labelClass}>Valor (R$)</Label>
          <Input
            id="valor"
            name="valor"
            type="number"
            step="0.01"
            min="0.01"
            required
            className={inputClass}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data" className={labelClass}>Data</Label>
          <Input
            id="data"
            name="data"
            type="date"
            required
            className={inputClass}
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </div>
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Confirmar"}
        </Button>
        <Button type="button" variant="outline" render={<Link href={cancelarHref} />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
