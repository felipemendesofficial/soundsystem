"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProdutoFormState } from "./actions";

type Action = (prevState: ProdutoFormState, formData: FormData) => Promise<ProdutoFormState>;

export function ProdutoForm({
  action,
  defaultValues,
}: {
  action: Action;
  defaultValues?: {
    sku: string;
    nome: string;
    categoria: string;
    marca: string | null;
    modelo: string | null;
    unidadeMedida: string;
    fotoUrl: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sku">SKU</Label>
        <Input id="sku" name="sku" required defaultValue={defaultValues?.sku} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="categoria">Categoria</Label>
        <Input
          id="categoria"
          name="categoria"
          required
          placeholder="Ex.: mesas de som, caixas, microfones"
          defaultValue={defaultValues?.categoria}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="marca">Marca</Label>
          <Input id="marca" name="marca" defaultValue={defaultValues?.marca ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="modelo">Modelo</Label>
          <Input id="modelo" name="modelo" defaultValue={defaultValues?.modelo ?? ""} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="unidadeMedida">Unidade de Medida</Label>
        <Select
          name="unidadeMedida"
          defaultValue={defaultValues?.unidadeMedida ?? "unidade"}
          items={{ unidade: "Unidade", metro: "Metro", kit: "Kit" }}
        >
          <SelectTrigger id="unidadeMedida" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unidade">Unidade</SelectItem>
            <SelectItem value="metro">Metro</SelectItem>
            <SelectItem value="kit">Kit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fotoUrl">URL da Foto (opcional)</Label>
        <Input id="fotoUrl" name="fotoUrl" defaultValue={defaultValues?.fotoUrl ?? ""} />
      </div>

      {state.erro && <p className="text-sm text-destructive">{state.erro}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
