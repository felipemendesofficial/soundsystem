"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UsuarioFormState } from "./actions";

type Action = (prevState: UsuarioFormState, formData: FormData) => Promise<UsuarioFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function UsuarioForm({
  action,
  depositos,
  defaultValues,
  ehEdicao = false,
}: {
  action: Action;
  depositos: { id: string; nome: string }[];
  defaultValues?: {
    nome: string;
    email: string;
    perfil: string;
    depositoPadraoId: string | null;
    ativo: boolean;
  };
  ehEdicao?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="nome" className={labelClass}>Nome</Label>
        <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} className={inputClass} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className={labelClass}>Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={defaultValues?.email}
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="senha" className={labelClass}>
          {ehEdicao ? "Nova senha (deixe em branco para manter)" : "Senha"}
        </Label>
        <Input
          id="senha"
          name="senha"
          type="password"
          required={!ehEdicao}
          autoComplete="new-password"
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="perfil" className={labelClass}>Perfil</Label>
        <Select
          name="perfil"
          defaultValue={defaultValues?.perfil ?? "vendedor"}
          items={{ admin: "Administrador", estoquista: "Estoquista", vendedor: "Vendedor" }}
        >
          <SelectTrigger id="perfil" className={`w-full ${inputClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Administrador</SelectItem>
            <SelectItem value="estoquista">Estoquista</SelectItem>
            <SelectItem value="vendedor">Vendedor</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Vendedores não visualizam custo médio nem margem em nenhuma tela.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="depositoPadraoId" className={labelClass}>Depósito padrão</Label>
        <Select
          name="depositoPadraoId"
          defaultValue={defaultValues?.depositoPadraoId ?? undefined}
          items={Object.fromEntries(depositos.map((d) => [d.id, d.nome]))}
        >
          <SelectTrigger id="depositoPadraoId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Nenhum" />
          </SelectTrigger>
          <SelectContent>
            {depositos.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="ativo"
          name="ativo"
          type="checkbox"
          defaultChecked={defaultValues?.ativo ?? true}
          className="size-4"
        />
        <Label htmlFor="ativo" className={labelClass}>Usuário ativo</Label>
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/usuarios" />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
