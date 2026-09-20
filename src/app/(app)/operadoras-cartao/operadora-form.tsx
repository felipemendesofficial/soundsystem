"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OperadoraFormState } from "./actions";

type Action = (prevState: OperadoraFormState, formData: FormData) => Promise<OperadoraFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export type OperadoraDefaultValues = {
  descricao: string;
  email: string | null;
  cnpj: string | null;
  telefoneSuporte: string | null;
  telefoneContato: string | null;
  telefoneAutorizacao: string | null;
  telefoneManutencao: string | null;
  telefoneAntecipacao: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  pais: string | null;
  nomePais: string | null;
};

export function OperadoraForm({
  action,
  cancelarHref,
  defaultValues,
}: {
  action: Action;
  cancelarHref: string;
  defaultValues?: OperadoraDefaultValues;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="descricao" className={labelClass}>Descrição</Label>
        <Input id="descricao" name="descricao" required defaultValue={defaultValues?.descricao} className={inputClass} placeholder="Ex.: Cielo, Stone, Rede" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="email" className={labelClass}>Email</Label>
          <Input id="email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cnpj" className={labelClass}>CNPJ</Label>
          <Input id="cnpj" name="cnpj" defaultValue={defaultValues?.cnpj ?? ""} className={inputClass} />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <Label className={labelClass}>Telefones</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="telefoneSuporte" className="text-xs">Suporte</Label>
            <Input id="telefoneSuporte" name="telefoneSuporte" defaultValue={defaultValues?.telefoneSuporte ?? ""} className="h-10 bg-background" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="telefoneContato" className="text-xs">Contato</Label>
            <Input id="telefoneContato" name="telefoneContato" defaultValue={defaultValues?.telefoneContato ?? ""} className="h-10 bg-background" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="telefoneAutorizacao" className="text-xs">Autorização</Label>
            <Input id="telefoneAutorizacao" name="telefoneAutorizacao" defaultValue={defaultValues?.telefoneAutorizacao ?? ""} className="h-10 bg-background" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="telefoneManutencao" className="text-xs">Manutenção</Label>
            <Input id="telefoneManutencao" name="telefoneManutencao" defaultValue={defaultValues?.telefoneManutencao ?? ""} className="h-10 bg-background" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="telefoneAntecipacao" className="text-xs">Antecipação</Label>
            <Input id="telefoneAntecipacao" name="telefoneAntecipacao" defaultValue={defaultValues?.telefoneAntecipacao ?? ""} className="h-10 bg-background" />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <Label className={labelClass}>Endereço</Label>
        <div className="grid grid-cols-2 gap-3">
          <Input name="endereco" placeholder="Endereço" defaultValue={defaultValues?.endereco ?? ""} className="col-span-2 h-10 bg-background" />
          <Input name="numero" placeholder="Número" defaultValue={defaultValues?.numero ?? ""} className="h-10 bg-background" />
          <Input name="complemento" placeholder="Complemento" defaultValue={defaultValues?.complemento ?? ""} className="h-10 bg-background" />
          <Input name="bairro" placeholder="Bairro" defaultValue={defaultValues?.bairro ?? ""} className="h-10 bg-background" />
          <Input name="cidade" placeholder="Cidade" defaultValue={defaultValues?.cidade ?? ""} className="h-10 bg-background" />
          <Input name="uf" placeholder="UF" defaultValue={defaultValues?.uf ?? ""} className="h-10 bg-background" />
          <Input name="cep" placeholder="CEP" defaultValue={defaultValues?.cep ?? ""} className="h-10 bg-background" />
          <Input name="pais" placeholder="País" defaultValue={defaultValues?.pais ?? ""} className="h-10 bg-background" />
          <Input name="nomePais" placeholder="Nome do País (se diferente)" defaultValue={defaultValues?.nomePais ?? ""} className="h-10 bg-background" />
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
