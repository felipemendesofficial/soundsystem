"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FornecedorFormState } from "./actions";

type Action = (prevState: FornecedorFormState, formData: FormData) => Promise<FornecedorFormState>;

export function FornecedorForm({
  action,
  defaultValues,
}: {
  action: Action;
  defaultValues?: {
    nome: string;
    tipoPessoa: string;
    documento: string | null;
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
        <Label htmlFor="tipoPessoa">Tipo</Label>
        <Select
          name="tipoPessoa"
          defaultValue={defaultValues?.tipoPessoa ?? "fisica"}
          items={{ fisica: "Pessoa Física", juridica: "Pessoa Jurídica" }}
        >
          <SelectTrigger id="tipoPessoa" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fisica">Pessoa Física</SelectItem>
            <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="documento">CPF / CNPJ</Label>
        <Input id="documento" name="documento" defaultValue={defaultValues?.documento ?? ""} />
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
