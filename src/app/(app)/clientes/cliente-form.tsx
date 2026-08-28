"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ClienteFormState } from "./actions";

type Action = (prevState: ClienteFormState, formData: FormData) => Promise<ClienteFormState>;

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
    <form action={formAction} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome / Razão Social</Label>
        <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tipoCliente">Tipo de Cliente</Label>
        <Select
          name="tipoCliente"
          defaultValue={defaultValues?.tipoCliente ?? "varejista"}
          items={{ varejista: "Varejista", atacadista: "Atacadista" }}
        >
          <SelectTrigger id="tipoCliente" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="varejista">Varejista</SelectItem>
            <SelectItem value="atacadista">Atacadista</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="telefone">Telefone</Label>
        <Input id="telefone" name="telefone" defaultValue={defaultValues?.telefone ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} />
      </div>

      {state.erro && <p className="text-sm text-destructive">{state.erro}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
