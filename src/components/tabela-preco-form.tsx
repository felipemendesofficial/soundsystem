"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TabelaPrecoFormState } from "@/app/(app)/tabela-precos/actions";

export type ProdutoPreco = {
  id: string;
  sku: string;
  nome: string;
  custoMedio: number | null;
};

type Action = (prevState: TabelaPrecoFormState, formData: FormData) => Promise<TabelaPrecoFormState>;

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function TabelaPrecoForm({
  action,
  produtos,
  defaultValues,
}: {
  action: Action;
  produtos: ProdutoPreco[];
  defaultValues?: {
    nome: string;
    ativo: boolean;
    precos: Record<string, string>;
  };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [busca, setBusca] = useState("");
  const [precos, setPrecos] = useState<Record<string, string>>(defaultValues?.precos ?? {});

  const termo = busca.trim().toLowerCase();
  const produtosFiltrados = termo
    ? produtos.filter((p) => `${p.nome} ${p.sku}`.toLowerCase().includes(termo))
    : produtos;

  const itensSerializados = useMemo(
    () =>
      JSON.stringify(
        Object.entries(precos)
          .filter(([, valor]) => valor.trim() !== "")
          .map(([produtoId, valor]) => ({ produtoId, preco: valor }))
      ),
    [precos]
  );

  const precificados = Object.values(precos).filter((v) => v.trim() !== "").length;

  return (
    <form action={formAction} className="max-w-lg space-y-6">
      <input type="hidden" name="itens" value={itensSerializados} />

      <div className="space-y-2">
        <Label htmlFor="nome" className={labelClass}>Nome da Tabela</Label>
        <Input
          id="nome"
          name="nome"
          required
          placeholder="Ex.: Varejo, Atacado, Promoção Black Friday"
          defaultValue={defaultValues?.nome}
          className={inputClass}
        />
      </div>

      <div className="flex items-center gap-3">
        <Checkbox id="ativo" name="ativo" defaultChecked={defaultValues?.ativo ?? true} />
        <Label htmlFor="ativo" className={labelClass}>Ativa</Label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className={labelClass}>Preços por Produto</Label>
          <span className="text-xs text-muted-foreground">{precificados} de {produtos.length} precificados</span>
        </div>

        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por descrição ou SKU"
          aria-label="Buscar produto"
        />

        <ul className="max-h-[480px] space-y-2 overflow-y-auto">
          {produtosFiltrados.map((produto) => {
            const valor = precos[produto.id] ?? "";
            const precoNumero = Number(valor);
            const margem =
              valor.trim() !== "" && precoNumero > 0 && produto.custoMedio !== null && produto.custoMedio > 0
                ? ((precoNumero - produto.custoMedio) / precoNumero) * 100
                : null;

            return (
              <li key={produto.id} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 min-w-0">
                  <div className="truncate text-[14px] font-medium">{produto.nome}</div>
                  <div className="truncate text-[12px] text-muted-foreground">{produto.sku}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Sem preço nesta tabela"
                    value={valor}
                    onChange={(e) => setPrecos((atual) => ({ ...atual, [produto.id]: e.target.value }))}
                    className="h-10 bg-background"
                  />
                  {margem !== null && (
                    <span
                      className={
                        "flex-none text-xs font-semibold " +
                        (margem >= 0 ? "text-brand-green" : "text-destructive")
                      }
                    >
                      {margem.toFixed(0)}% margem
                    </span>
                  )}
                </div>
                {produto.custoMedio !== null && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Custo médio atual: {formatarMoeda(produto.custoMedio)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Salvar Tabela de Preço"}
        </Button>
        <Button
          type="button"
          variant="outline"
          render={<Link href="/tabela-precos" />}
          className="h-11 px-7 text-base"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
