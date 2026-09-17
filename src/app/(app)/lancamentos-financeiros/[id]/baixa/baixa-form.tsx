"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BaixaFormState } from "../../actions";

type Action = (prevState: BaixaFormState, formData: FormData) => Promise<BaixaFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Prévia client-side em `number` — a mesma fórmula de `src/lib/juros-mora.ts`
 * (pro-rata simples, mês fixo de 30 dias), recomputada com `Decimal` no
 * server ao confirmar. Mesmo padrão de duplicação já usado em
 * `orcamento-form.tsx` pro cálculo de rateio.
 */
function calcularJurosMoraPreview(valorOriginal: number, moraMes: number | null, dataVencimento: string, dataBaixa: string): number {
  if (!moraMes) return 0;
  const diasAtraso = Math.max(0, Math.round((new Date(dataBaixa).getTime() - new Date(dataVencimento).getTime()) / 86400000));
  if (diasAtraso === 0) return 0;
  return (valorOriginal * (moraMes / 30) * diasAtraso) / 100;
}

export function BaixaForm({
  action,
  cancelarHref,
  contas,
  contaPrevistaId,
  valorOriginal,
  dataVencimento,
  moraMes,
}: {
  action: Action;
  cancelarHref: string;
  contas: { id: string; label: string }[];
  contaPrevistaId?: string | null;
  valorOriginal: number;
  dataVencimento: string;
  moraMes: number | null;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [dataBaixa, setDataBaixa] = useState(hojeISO());
  const [juros, setJuros] = useState(() => calcularJurosMoraPreview(valorOriginal, moraMes, dataVencimento, hojeISO()).toFixed(2));
  const [multa, setMulta] = useState("0");
  const [desconto, setDesconto] = useState("0");

  const itensContas = Object.fromEntries(contas.map((c) => [c.id, c.label]));

  const valorBaixado = useMemo(() => {
    return valorOriginal + (Number(juros) || 0) + (Number(multa) || 0) - (Number(desconto) || 0);
  }, [valorOriginal, juros, multa, desconto]);

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="contaId" className={labelClass}>Conta</Label>
        <Select name="contaId" defaultValue={contaPrevistaId ?? undefined} items={itensContas}>
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
        <Label htmlFor="dataBaixa" className={labelClass}>Data da Baixa</Label>
        <Input
          id="dataBaixa"
          name="dataBaixa"
          type="date"
          required
          value={dataBaixa}
          onChange={(e) => {
            setDataBaixa(e.target.value);
            setJuros(calcularJurosMoraPreview(valorOriginal, moraMes, dataVencimento, e.target.value).toFixed(2));
          }}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="juros" className={labelClass}>Juros (R$)</Label>
          <Input id="juros" name="juros" type="number" step="0.01" min="0" value={juros} onChange={(e) => setJuros(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="multa" className={labelClass}>Multa (R$)</Label>
          <Input id="multa" name="multa" type="number" step="0.01" min="0" value={multa} onChange={(e) => setMulta(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desconto" className={labelClass}>Desconto (R$)</Label>
          <Input id="desconto" name="desconto" type="number" step="0.01" min="0" value={desconto} onChange={(e) => setDesconto(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="historicoComplementar" className={labelClass}>Histórico Complementar (opcional)</Label>
        <Input id="historicoComplementar" name="historicoComplementar" className={inputClass} />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 text-sm">
        <span className="text-muted-foreground">Valor a baixar</span>
        <span className="text-base font-semibold">{formatarMoeda(valorBaixado)}</span>
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Confirmar Baixa"}
        </Button>
        <Button type="button" variant="outline" render={<Link href={cancelarHref} />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
