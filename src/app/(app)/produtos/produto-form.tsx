"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProdutoFormState } from "./actions";

type Action = (prevState: ProdutoFormState, formData: FormData) => Promise<ProdutoFormState>;

type Opcao = { id: string; nome: string };

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function ProdutoForm({
  action,
  categorias,
  unidadesMedida,
  defaultValues,
}: {
  action: Action;
  categorias: Opcao[];
  unidadesMedida: Opcao[];
  defaultValues?: {
    sku: string;
    nome: string;
    categoriaId: string;
    marca: string | null;
    modelo: string | null;
    unidadeMedidaId: string;
    fotoUrl: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(action, {});

  const categoriasItems = Object.fromEntries(categorias.map((c) => [c.id, c.nome]));
  const unidadesItems = Object.fromEntries(unidadesMedida.map((u) => [u.id, u.nome]));

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
        <Label htmlFor="categoriaId" className={labelClass}>Categoria</Label>
        <Select name="categoriaId" defaultValue={defaultValues?.categoriaId} items={categoriasItems}>
          <SelectTrigger id="categoriaId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione a categoria" />
          </SelectTrigger>
          <SelectContent>
            {categorias.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Label htmlFor="unidadeMedidaId" className={labelClass}>Unidade de Medida</Label>
        <Select name="unidadeMedidaId" defaultValue={defaultValues?.unidadeMedidaId} items={unidadesItems}>
          <SelectTrigger id="unidadeMedidaId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione a unidade" />
          </SelectTrigger>
          <SelectContent>
            {unidadesMedida.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nome}
              </SelectItem>
            ))}
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
