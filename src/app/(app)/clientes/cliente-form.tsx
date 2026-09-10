"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ClienteFormState } from "./actions";

type Action = (prevState: ClienteFormState, formData: FormData) => Promise<ClienteFormState>;

type Opcao = { id: string; nome: string };

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function ClienteForm({
  action,
  tabelasPreco,
  defaultValues,
}: {
  action: Action;
  tabelasPreco: Opcao[];
  defaultValues?: {
    nome: string;
    tipoCliente: string;
    telefone: string | null;
    email: string | null;
    tabelaPrecoPadraoId: string | null;
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

      <div className="space-y-2">
        <Label htmlFor="tabelaPrecoPadraoId" className={labelClass}>Tabela de Preço Padrão</Label>
        <Select
          name="tabelaPrecoPadraoId"
          defaultValue={defaultValues?.tabelaPrecoPadraoId ?? undefined}
          items={Object.fromEntries(tabelasPreco.map((t) => [t.id, t.nome]))}
        >
          <SelectTrigger id="tabelaPrecoPadraoId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Nenhuma" />
          </SelectTrigger>
          <SelectContent>
            {tabelasPreco.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Sugerida automaticamente ao lançar uma venda ou OS para esse cliente.
        </p>
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
