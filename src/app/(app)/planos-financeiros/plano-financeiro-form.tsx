"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PlanoFinanceiroFormState } from "./actions";

type Action = (prevState: PlanoFinanceiroFormState, formData: FormData) => Promise<PlanoFinanceiroFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

const TIPOS = { receita: "Receita", despesa: "Despesa" };

export function PlanoFinanceiroForm({
  action,
  cancelarHref,
  prefixo,
  qtdDigitos,
  analiticaNaCriacao = false,
  defaultValues,
}: {
  action: Action;
  cancelarHref: string;
  /** Prefixo fixo do pai (ex: "1.01"), ou null se for uma conta raiz. Só usado ao criar — não editável depois. */
  prefixo?: string | null;
  /** Quantos dígitos o nível atual aceita. Só usado ao criar. */
  qtdDigitos?: number;
  /** Se a conta sendo criada agora vai nascer Analítica (último nível da máscara) — só então faz sentido oferecer o indicador de Retenção. */
  analiticaNaCriacao?: boolean;
  defaultValues?: { codigo: string; descricao: string; tipo: string; natureza: string; permiteRetencao: boolean };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const editando = defaultValues !== undefined;
  const mostrarPermiteRetencao = editando ? defaultValues.natureza === "analitica" : analiticaNaCriacao;

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

      <div className="space-y-2">
        <Label htmlFor="tipo" className={labelClass}>Tipo</Label>
        <Select name="tipo" items={TIPOS} defaultValue={defaultValues?.tipo ?? "despesa"}>
          <SelectTrigger id="tipo" className={`w-full ${inputClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TIPOS).map(([valor, rotulo]) => (
              <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mostrarPermiteRetencao && (
        <div className="flex items-center gap-3">
          <Checkbox id="permiteRetencao" name="permiteRetencao" defaultChecked={defaultValues?.permiteRetencao ?? false} />
          <Label htmlFor="permiteRetencao" className={labelClass}>Pode ser indicada como Retenção nos Lançamentos</Label>
        </div>
      )}

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
