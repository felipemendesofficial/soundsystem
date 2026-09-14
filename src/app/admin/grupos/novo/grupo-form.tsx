"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarGrupo } from "../actions";

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function GrupoForm() {
  const [state, formAction, pending] = useActionState(criarGrupo, {});

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-base font-semibold">Grupo</h2>
        <div className="space-y-2">
          <Label htmlFor="grupoNome" className={labelClass}>Nome do grupo</Label>
          <Input id="grupoNome" name="grupoNome" required className={inputClass} />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-base font-semibold">Primeira empresa</h2>
        <div className="space-y-2">
          <Label htmlFor="empresaNome" className={labelClass}>Nome da empresa</Label>
          <Input id="empresaNome" name="empresaNome" required className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="empresaCnpj" className={labelClass}>CNPJ (opcional)</Label>
          <Input id="empresaCnpj" name="empresaCnpj" className={inputClass} />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-base font-semibold">Primeiro administrador</h2>
        <p className="text-xs text-muted-foreground">
          Esse usuário vai poder gerenciar o grupo (cadastros, usuários, demais empresas).
        </p>
        <div className="space-y-2">
          <Label htmlFor="adminNome" className={labelClass}>Nome</Label>
          <Input id="adminNome" name="adminNome" required className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adminEmail" className={labelClass}>Email</Label>
          <Input id="adminEmail" name="adminEmail" type="email" required className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adminSenha" className={labelClass}>Senha</Label>
          <Input
            id="adminSenha"
            name="adminSenha"
            type="password"
            required
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Criando..." : "Criar Grupo"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/admin/grupos" />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
