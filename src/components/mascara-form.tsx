"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type MascaraFormState = { erro?: string };

type SegmentoEditavel = { ordem: number; qtdDigitos: number; nome: string };

type Action = (prevState: MascaraFormState, formData: FormData) => Promise<MascaraFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

/**
 * Form compartilhado pelas 3 máscaras (Plano Financeiro, Centro de Custo,
 * Processo) — mesmo editor de segmentos (níveis) nas 3, então extraído em vez
 * de copiado (ao contrário do padrão de cadastro plano da leva 1, aqui a
 * lógica não é trivial o bastante pra copiar 3x). Os segmentos viajam num
 * hidden input JSON — não há precedente de field-array indexado em FormData
 * neste projeto, e um array dinâmico de tamanho variável é mais simples assim
 * do que com nomes de campo tipo `segmentos[0].qtdDigitos`.
 */
export function MascaraForm({
  action,
  cancelarHref,
  defaultValues,
  segmentosEditaveis = true,
}: {
  action: Action;
  cancelarHref: string;
  defaultValues?: {
    nome: string;
    segmentos: { ordem: number; qtdDigitos: number; nome: string | null }[];
  };
  segmentosEditaveis?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [segmentos, setSegmentos] = useState<SegmentoEditavel[]>(
    () =>
      defaultValues?.segmentos.map((s) => ({ ordem: s.ordem, qtdDigitos: s.qtdDigitos, nome: s.nome ?? "" })) ?? [
        { ordem: 1, qtdDigitos: 1, nome: "" },
      ]
  );

  function adicionarSegmento() {
    setSegmentos((atual) => [...atual, { ordem: atual.length + 1, qtdDigitos: 2, nome: "" }]);
  }

  function removerSegmento(index: number) {
    setSegmentos((atual) => atual.filter((_, i) => i !== index).map((s, i) => ({ ...s, ordem: i + 1 })));
  }

  function atualizarSegmento(index: number, patch: Partial<SegmentoEditavel>) {
    setSegmentos((atual) => atual.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="nome" className={labelClass}>Nome</Label>
        <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} className={inputClass} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className={labelClass}>Níveis</Label>
          {segmentosEditaveis && (
            <button type="button" onClick={adicionarSegmento} className="text-sm font-medium text-primary">
              + Adicionar nível
            </button>
          )}
        </div>

        {!segmentosEditaveis && (
          <p className="text-[13px] text-muted-foreground">
            Já existem registros usando esta máscara — os níveis não podem mais ser alterados.
          </p>
        )}

        <div className="space-y-2">
          {segmentos.map((seg, index) => (
            <div key={index} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5">
              <span className="w-6 flex-none text-center text-xs text-muted-foreground">{seg.ordem}º</span>
              <Input
                type="number"
                min={1}
                max={9}
                value={seg.qtdDigitos}
                onChange={(e) => atualizarSegmento(index, { qtdDigitos: Number(e.target.value) })}
                disabled={!segmentosEditaveis}
                className="h-9 w-16 flex-none text-center"
                aria-label={`Dígitos do nível ${seg.ordem}`}
              />
              <Input
                value={seg.nome}
                onChange={(e) => atualizarSegmento(index, { nome: e.target.value })}
                disabled={!segmentosEditaveis}
                placeholder="Nome do nível (opcional)"
                className="h-9 flex-1"
              />
              {segmentosEditaveis && segmentos.length > 1 && (
                <button
                  type="button"
                  onClick={() => removerSegmento(index)}
                  className="flex-none text-destructive"
                  aria-label={`Remover nível ${seg.ordem}`}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <input type="hidden" name="segmentosJson" value={JSON.stringify(segmentos)} />

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
