"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIPOS_CARTAO_MODALIDADE_LABEL, TIPOS_REPASSE_LABEL } from "@/lib/financeiro-labels";
import type { TaxaFormState } from "./actions";

type Action = (prevState: TaxaFormState, formData: FormData) => Promise<TaxaFormState>;

type Bandeira = { id: string; nome: string };

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function TaxaForm({
  action,
  cancelarHref,
  bandeiras,
  defaultValues,
}: {
  action: Action;
  cancelarHref: string;
  bandeiras: Bandeira[];
  defaultValues?: {
    bandeiraId: string;
    modalidade: string;
    taxaAvista: string;
    taxaAntecipacao: string;
    taxaParcEstabelecimento: string;
    taxaParcCliente: string;
    nDias: string;
    tipoRepasse: string;
  };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const itensBandeiras = Object.fromEntries(bandeiras.map((b) => [b.id, b.nome]));

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="bandeiraId" className={labelClass}>Bandeira</Label>
        <Select name="bandeiraId" defaultValue={defaultValues?.bandeiraId} items={itensBandeiras}>
          <SelectTrigger id="bandeiraId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {bandeiras.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="modalidade" className={labelClass}>Modalidade</Label>
        <Select name="modalidade" defaultValue={defaultValues?.modalidade} items={TIPOS_CARTAO_MODALIDADE_LABEL}>
          <SelectTrigger id="modalidade" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TIPOS_CARTAO_MODALIDADE_LABEL).map(([valor, rotulo]) => (
              <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="taxaAvista" className={labelClass}>Taxa à Vista (%)</Label>
          <Input id="taxaAvista" name="taxaAvista" type="number" step="0.01" min="0" required defaultValue={defaultValues?.taxaAvista} className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="taxaAntecipacao" className={labelClass}>Taxa Antecipação (%)</Label>
          <Input id="taxaAntecipacao" name="taxaAntecipacao" type="number" step="0.01" min="0" required defaultValue={defaultValues?.taxaAntecipacao} className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="taxaParcEstabelecimento" className={labelClass}>Parc. Estabelecimento (%)</Label>
          <Input id="taxaParcEstabelecimento" name="taxaParcEstabelecimento" type="number" step="0.01" min="0" required defaultValue={defaultValues?.taxaParcEstabelecimento} className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="taxaParcCliente" className={labelClass}>Parc. Cliente (%)</Label>
          <Input id="taxaParcCliente" name="taxaParcCliente" type="number" step="0.01" min="0" required defaultValue={defaultValues?.taxaParcCliente} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="nDias" className={labelClass}>Prazo de Repasse (dias)</Label>
          <Input id="nDias" name="nDias" type="number" step="1" min="0" required defaultValue={defaultValues?.nDias} className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tipoRepasse" className={labelClass}>Tipo de Repasse</Label>
          <Select name="tipoRepasse" defaultValue={defaultValues?.tipoRepasse} items={TIPOS_REPASSE_LABEL}>
            <SelectTrigger id="tipoRepasse" className={`w-full ${inputClass}`}>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIPOS_REPASSE_LABEL).map(([valor, rotulo]) => (
                <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
