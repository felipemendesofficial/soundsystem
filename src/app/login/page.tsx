"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { autenticar, type LoginState } from "./actions";

const estadoInicial: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(autenticar, estadoInicial);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Controle de Estoque</h1>
        <p className="mb-6 text-sm text-muted-foreground">Entre com seu email e senha</p>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input id="senha" name="senha" type="password" required autoComplete="current-password" />
          </div>

          {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
