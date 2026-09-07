"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ClienteFormState } from "./actions";

type Action = (prevState: ClienteFormState, formData: FormData) => Promise<ClienteFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function ClienteForm({
  action,
  defaultValues,
}: {
  action: Action;
  defaultValues?: {
    nome: string;
    tipoCliente: string;
    telefone: string | null;
    email: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="nome" className={labelClass}>Nome / Razão Social</Label>
        <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} className={inputClass} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tipoCliente" className={labelClass}>Tipo de Cliente</Label>
        <Select
          name="tipoCliente"
          defaultValue={defaultValues?.tipoCliente ?? "varejista"}
          items={{ varejista: "Varejista", atacadista: "Atacadista" }}
        >
          <SelectTrigger id="tipoCliente" className={`w-full ${inputClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="varejista">Varejista</SelectItem>
            <SelectItem value="atacadista">Atacadista</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="telefone" className={labelClass}>Telefone</Label>
        <Input id="telefone" name="telefone" defaultValue={defaultValues?.telefone ?? ""} className={inputClass} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className={labelClass}>Email</Label>
        <Input id="email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} className={inputClass} />
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/clientes" />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
