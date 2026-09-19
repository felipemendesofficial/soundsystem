"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIPOS_DOCUMENTO_LABEL } from "@/lib/financeiro-labels";
import type { RecolhimentoFormState } from "../actions";

type Action = (prevState: RecolhimentoFormState, formData: FormData) => Promise<RecolhimentoFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

const TIPOS_DOCUMENTO_RECOLHIMENTO = [
  "especie",
  "cheque_vista",
  "cheque_prazo",
  "deposito_cartorio",
  "nota_promissoria",
  "deposito_bancario",
  "pix",
] as const;

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export function RecolhimentoForm({
  action,
  cancelarHref,
  processos,
  processoItens,
  processoPadraoId,
}: {
  action: Action;
  cancelarHref: string;
  processos: { id: string; label: string }[];
  processoItens: { id: string; label: string; processoId: string }[];
  processoPadraoId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [processoId, setProcessoId] = useState(processoPadraoId ?? "");
  const [tipoDocumento, setTipoDocumento] = useState("especie");

  const itensProcessos = Object.fromEntries(processos.map((p) => [p.id, p.label]));
  const itensDoProcesso = useMemo(() => processoItens.filter((i) => i.processoId === processoId), [processoItens, processoId]);
  const [processoItemId, setProcessoItemId] = useState(itensDoProcesso.length === 1 ? itensDoProcesso[0].id : "");
  const itensProcessoItem = Object.fromEntries(itensDoProcesso.map((i) => [i.id, i.label]));

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="processoId" className={labelClass}>Processo</Label>
        <Select
          name="processoId"
          value={processoId}
          items={itensProcessos}
          onValueChange={(v) => {
            setProcessoId(v ?? "");
            const itens = processoItens.filter((i) => i.processoId === v);
            setProcessoItemId(itens.length === 1 ? itens[0].id : "");
          }}
        >
          <SelectTrigger id="processoId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {processos.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="processoItemId" className={labelClass}>Item do Processo</Label>
        <Select name="processoItemId" value={processoItemId} items={itensProcessoItem} onValueChange={(v) => setProcessoItemId(v ?? "")}>
          <SelectTrigger id="processoItemId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {itensDoProcesso.map((i) => (
              <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tipoDocumento" className={labelClass}>Tipo de Documento</Label>
        <Select name="tipoDocumento" value={tipoDocumento} items={TIPOS_DOCUMENTO_LABEL} onValueChange={(v) => v && setTipoDocumento(v)}>
          <SelectTrigger id="tipoDocumento" className={`w-full ${inputClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_DOCUMENTO_RECOLHIMENTO.map((valor) => (
              <SelectItem key={valor} value={valor}>{TIPOS_DOCUMENTO_LABEL[valor]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="dataEmissao" className={labelClass}>Emissão</Label>
          <Input id="dataEmissao" name="dataEmissao" type="date" required defaultValue={hojeISO()} className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dataVencimento" className={labelClass}>Vencimento</Label>
          <Input id="dataVencimento" name="dataVencimento" type="date" required defaultValue={hojeISO()} className={inputClass} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacao" className={labelClass}>Observação (opcional)</Label>
        <Input id="observacao" name="observacao" className={inputClass} />
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Gerando..." : "Gerar Recolhimento"}
        </Button>
        <Button type="button" variant="outline" render={<Link href={cancelarHref} />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
