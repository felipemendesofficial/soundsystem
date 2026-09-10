"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { VendedorFormState } from "./actions";

type Action = (prevState: VendedorFormState, formData: FormData) => Promise<VendedorFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function VendedorForm({
  action,
  defaultValues,
}: {
  action: Action;
  defaultValues?: {
    nome: string;
    ativo: boolean;
    recebeComissao: boolean;
    tipoComissao: string | null;
    valorComissao: string | number | null;
  };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [recebeComissao, setRecebeComissao] = useState(defaultValues?.recebeComissao ?? false);
  const [tipoComissao, setTipoComissao] = useState(defaultValues?.tipoComissao ?? "percentual");

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="nome" className={labelClass}>Nome</Label>
        <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} className={inputClass} />
      </div>

      <div className="flex items-center gap-3">
        <Checkbox id="ativo" name="ativo" defaultChecked={defaultValues?.ativo ?? true} />
        <Label htmlFor="ativo" className={labelClass}>Ativo</Label>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Checkbox
            id="recebeComissao"
            name="recebeComissao"
            checked={recebeComissao}
            onCheckedChange={(marcado) => setRecebeComissao(marcado === true)}
          />
          <Label htmlFor="recebeComissao" className={labelClass}>Recebe comissão</Label>
        </div>

        {recebeComissao && (
          <>
            <div className="space-y-2">
              <Label htmlFor="tipoComissao" className={labelClass}>Tipo de Comissão</Label>
              <Select
                name="tipoComissao"
                value={tipoComissao}
                items={{ percentual: "Percentual (%)", fixa: "Valor Fixo (R$)" }}
                onValueChange={(valor) => {
                  if (valor) setTipoComissao(valor);
                }}
              >
                <SelectTrigger id="tipoComissao" className={`w-full ${inputClass}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentual">Percentual (%)</SelectItem>
                  <SelectItem value="fixa">Valor Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valorComissao" className={labelClass}>
                {tipoComissao === "percentual" ? "Percentual (%)" : "Valor (R$)"}
              </Label>
              <Input
                id="valorComissao"
                name="valorComissao"
                type="number"
                step="0.01"
                min="0"
                defaultValue={defaultValues?.valorComissao ?? ""}
                className={inputClass}
              />
            </div>
          </>
        )}
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/vendedores" />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
