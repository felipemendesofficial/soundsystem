"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxIcon,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { OrdemServicoFormState } from "@/app/(app)/ordens-servico/actions";

type Item = { id: string; label: string };
type ServicoItem = Item & { precoPadrao: number };

type Linha = {
  key: string;
  tipo: "produto" | "servico";
  item: Item | null;
  quantidade: string;
  precoUnitario: string;
};

type Action = (prevState: OrdemServicoFormState, formData: FormData) => Promise<OrdemServicoFormState>;

let contadorChave = 0;
function novaChave() {
  contadorChave += 1;
  return `linha-${contadorChave}`;
}

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function OSForm({
  action,
  clientes,
  depositos,
  produtos,
  servicos,
  depositoPadraoId,
  defaultValues,
}: {
  action: Action;
  clientes: Item[];
  depositos: Item[];
  produtos: Item[];
  servicos: ServicoItem[];
  depositoPadraoId?: string | null;
  defaultValues?: {
    clienteId: string;
    depositoId: string;
    observacao: string | null;
    itens: {
      tipo: "produto" | "servico";
      itemId: string;
      label: string;
      quantidade: string;
      precoUnitario: string;
    }[];
  };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    (defaultValues?.itens ?? []).map((i) => ({
      key: novaChave(),
      tipo: i.tipo,
      item: { id: i.itemId, label: i.label },
      quantidade: i.quantidade,
      precoUnitario: i.precoUnitario,
    }))
  );

  const clientesItems = Object.fromEntries(clientes.map((c) => [c.id, c.label]));
  const depositosItems = Object.fromEntries(depositos.map((d) => [d.id, d.label]));

  function adicionarLinha(tipo: "produto" | "servico") {
    setLinhas((atual) => [
      ...atual,
      { key: novaChave(), tipo, item: null, quantidade: "1", precoUnitario: "0" },
    ]);
  }

  function removerLinha(key: string) {
    setLinhas((atual) => atual.filter((l) => l.key !== key));
  }

  function atualizarLinha(key: string, patch: Partial<Linha>) {
    setLinhas((atual) => atual.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const itensSerializados = JSON.stringify(
    linhas
      .filter((l) => l.item !== null)
      .map((l) => ({
        tipo: l.tipo,
        itemId: l.item!.id,
        quantidade: l.quantidade,
        precoUnitario: l.precoUnitario,
      }))
  );

  const total = linhas.reduce((acc, l) => {
    const qtd = Number(l.quantidade) || 0;
    const preco = Number(l.precoUnitario) || 0;
    return acc + qtd * preco;
  }, 0);

  return (
    <form action={formAction} className="max-w-lg space-y-6">
      <input type="hidden" name="itens" value={itensSerializados} />

      <div className="space-y-2">
        <Label htmlFor="clienteId" className={labelClass}>Cliente</Label>
        <Select name="clienteId" defaultValue={defaultValues?.clienteId} items={clientesItems}>
          <SelectTrigger id="clienteId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione o cliente" />
          </SelectTrigger>
          <SelectContent>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="depositoId" className={labelClass}>Depósito</Label>
        <Select
          name="depositoId"
          defaultValue={defaultValues?.depositoId ?? depositoPadraoId ?? undefined}
          items={depositosItems}
        >
          <SelectTrigger id="depositoId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="De onde saem os produtos" />
          </SelectTrigger>
          <SelectContent>
            {depositos.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className={labelClass}>Itens</Label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => adicionarLinha("servico")}>
              + Serviço
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => adicionarLinha("produto")}>
              + Produto
            </Button>
          </div>
        </div>

        {linhas.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nenhum item adicionado.
          </p>
        )}

        <ul className="space-y-3">
          {linhas.map((linha) => {
            const opcoes: Item[] = linha.tipo === "produto" ? produtos : servicos;
            return (
              <li key={linha.key} className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    {linha.tipo === "produto" ? "Produto" : "Serviço"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removerLinha(linha.key)}
                    aria-label="Remover item"
                  >
                    <Trash2 />
                  </Button>
                </div>

                <Combobox
                  items={opcoes}
                  value={linha.item}
                  onValueChange={(item: Item | null) => {
                    atualizarLinha(linha.key, {
                      item,
                      precoUnitario:
                        linha.tipo === "servico" && item
                          ? String((item as ServicoItem).precoPadrao)
                          : linha.precoUnitario,
                    });
                  }}
                  itemToStringLabel={(item: Item) => item.label}
                  itemToStringValue={(item: Item) => item.id}
                >
                  <ComboboxInputGroup>
                    <ComboboxInput
                      placeholder={linha.tipo === "produto" ? "Buscar produto..." : "Buscar serviço..."}
                    />
                    <ComboboxIcon />
                  </ComboboxInputGroup>
                  <ComboboxContent>
                    <ComboboxEmpty>Nada encontrado.</ComboboxEmpty>
                    <ComboboxList>
                      {(item: Item) => (
                        <ComboboxItem key={item.id} value={item}>
                          {item.label}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantidade</Label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={linha.quantidade}
                      onChange={(e) => atualizarLinha(linha.key, { quantidade: e.target.value })}
                      className="h-10 bg-card"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Preço Unit. (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={linha.precoUnitario}
                      onChange={(e) => atualizarLinha(linha.key, { precoUnitario: e.target.value })}
                      className="h-10 bg-card"
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {linhas.length > 0 && (
          <p className="text-right text-sm font-medium">
            Total: {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacao" className={labelClass}>Observação</Label>
        <Input
          id="observacao"
          name="observacao"
          defaultValue={defaultValues?.observacao ?? ""}
          className={inputClass}
        />
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Salvar Ordem de Serviço"}
        </Button>
        <Button
          type="button"
          variant="outline"
          render={<Link href="/ordens-servico" />}
          className="h-11 px-7 text-base"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
