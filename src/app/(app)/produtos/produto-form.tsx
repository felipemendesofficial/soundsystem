"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProdutoFormState } from "./actions";

type Action = (prevState: ProdutoFormState, formData: FormData) => Promise<ProdutoFormState>;

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

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
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="sku" className={labelClass}>SKU</Label>
        <Input id="sku" name="sku" required defaultValue={defaultValues?.sku} className={inputClass} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nome" className={labelClass}>Nome</Label>
        <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} className={inputClass} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="categoria" className={labelClass}>Categoria</Label>
        <Input
          id="categoria"
          name="categoria"
          required
          placeholder="Ex.: mesas de som, caixas, microfones"
          defaultValue={defaultValues?.categoria}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="marca" className={labelClass}>Marca</Label>
          <Input id="marca" name="marca" defaultValue={defaultValues?.marca ?? ""} className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="modelo" className={labelClass}>Modelo</Label>
          <Input id="modelo" name="modelo" defaultValue={defaultValues?.modelo ?? ""} className={inputClass} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="unidadeMedida" className={labelClass}>Unidade de Medida</Label>
        <Select
          name="unidadeMedida"
          defaultValue={defaultValues?.unidadeMedida ?? "unidade"}
          items={{ unidade: "Unidade", metro: "Metro", kit: "Kit" }}
        >
          <SelectTrigger id="unidadeMedida" className={`w-full ${inputClass}`}>
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
        <Label htmlFor="fotoUrl" className={labelClass}>URL da Foto (opcional)</Label>
        <Input id="fotoUrl" name="fotoUrl" defaultValue={defaultValues?.fotoUrl ?? ""} className={inputClass} />
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          render={<Link href="/produtos" />}
          className="h-11 px-7 text-base"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
