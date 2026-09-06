"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UsuarioFormState } from "./actions";

type Action = (prevState: UsuarioFormState, formData: FormData) => Promise<UsuarioFormState>;

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
    <form action={formAction} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required defaultValue={defaultValues?.email} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="senha">{ehEdicao ? "Nova senha (deixe em branco para manter)" : "Senha"}</Label>
        <Input id="senha" name="senha" type="password" required={!ehEdicao} autoComplete="new-password" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="perfil">Perfil</Label>
        <Select
          name="perfil"
          defaultValue={defaultValues?.perfil ?? "vendedor"}
          items={{ admin: "Administrador", estoquista: "Estoquista", vendedor: "Vendedor" }}
        >
          <SelectTrigger id="perfil" className="w-full">
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
        <Label htmlFor="depositoPadraoId">Depósito padrão</Label>
        <Select
          name="depositoPadraoId"
          defaultValue={defaultValues?.depositoPadraoId ?? undefined}
          items={Object.fromEntries(depositos.map((d) => [d.id, d.nome]))}
        >
          <SelectTrigger id="depositoPadraoId" className="w-full">
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
        <Label htmlFor="ativo">Usuário ativo</Label>
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
