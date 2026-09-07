"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FornecedorFormState } from "./actions";

type Action = (prevState: FornecedorFormState, formData: FormData) => Promise<FornecedorFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

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
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="nome" className={labelClass}>Nome / Razão Social</Label>
        <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} className={inputClass} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tipoPessoa" className={labelClass}>Tipo</Label>
        <Select
          name="tipoPessoa"
          defaultValue={defaultValues?.tipoPessoa ?? "fisica"}
          items={{ fisica: "Pessoa Física", juridica: "Pessoa Jurídica" }}
        >
          <SelectTrigger id="tipoPessoa" className={`w-full ${inputClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fisica">Pessoa Física</SelectItem>
            <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="documento" className={labelClass}>CPF / CNPJ</Label>
        <Input id="documento" name="documento" defaultValue={defaultValues?.documento ?? ""} className={inputClass} />
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
        <Button
          type="button"
          variant="outline"
          render={<Link href="/fornecedores" />}
          className="h-11 px-7 text-base"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
