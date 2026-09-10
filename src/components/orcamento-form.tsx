"use client";

import { useActionState, useMemo, useState } from "react";
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
import type { OrcamentoFormState } from "@/app/(app)/orcamentos/actions";

type Item = { id: string; label: string };
type ModoCalculo = "taxa" | "valor_total";

type Linha = {
  key: string;
  produto: Item | null;
  quantidade: string;
  valorEstimadoVenda: string;
};

type Action = (prevState: OrcamentoFormState, formData: FormData) => Promise<OrcamentoFormState>;

let contadorChave = 0;
function novaChave() {
  contadorChave += 1;
  return `linha-${contadorChave}`;
}

function linhaVazia(): Linha {
  return { key: novaChave(), produto: null, quantidade: "1", valorEstimadoVenda: "0" };
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarPercentual(valor: number) {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function OrcamentoForm({
  action,
  depositos,
  fornecedores,
  produtos,
  depositoPadraoId,
  defaultValues,
}: {
  action: Action;
  depositos: Item[];
  fornecedores: Item[];
  produtos: Item[];
  depositoPadraoId?: string | null;
  defaultValues?: {
    descricao: string | null;
    depositoId: string;
    fornecedorId: string | null;
    modoCalculo: ModoCalculo;
    taxaRevenda: string;
    valorCompraTotalInformado: string;
    itens: { produtoId: string; label: string; quantidade: string; valorEstimadoVenda: string }[];
  };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [modoCalculo, setModoCalculo] = useState<ModoCalculo>(defaultValues?.modoCalculo ?? "taxa");
  const [taxaRevenda, setTaxaRevenda] = useState(defaultValues?.taxaRevenda ?? "30");
  const [valorCompraTotalInformado, setValorCompraTotalInformado] = useState(
    defaultValues?.valorCompraTotalInformado ?? ""
  );
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    (defaultValues?.itens ?? []).map((i) => ({
      key: novaChave(),
      produto: { id: i.produtoId, label: i.label },
      quantidade: i.quantidade,
      valorEstimadoVenda: i.valorEstimadoVenda,
    }))
  );

  const depositosItems = Object.fromEntries(depositos.map((d) => [d.id, d.label]));
  const fornecedoresItems = Object.fromEntries(fornecedores.map((f) => [f.id, f.label]));

  function adicionarLinha() {
    // Novo item entra no topo da lista, ao lado do botão "+ Produto" — assim
    // fica visível sem rolar a tela, útil ao lançar vários itens seguidos.
    setLinhas((atual) => [linhaVazia(), ...atual]);
  }

  function removerLinha(key: string) {
    setLinhas((atual) => atual.filter((l) => l.key !== key));
  }

  function atualizarLinha(key: string, patch: Partial<Linha>) {
    setLinhas((atual) => atual.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const itensSerializados = JSON.stringify(
    linhas
      .filter((l) => l.produto !== null)
      .map((l) => ({
        produtoId: l.produto!.id,
        quantidade: l.quantidade,
        valorEstimadoVenda: l.valorEstimadoVenda,
      }))
  );

  // Prévia calculada no cliente — a mesma fórmula de src/lib/orcamento.ts
  // (fator = valorLinha / valorVendaTotal; custoCompra = fator * valorCompraTotal),
  // só que em número comum em vez de Decimal, para feedback instantâneo ao
  // digitar. O valor que realmente vira Kardex é recalculado com Decimal no
  // servidor, ao finalizar.
  const preview = useMemo(() => {
    const itens = linhas.map((l) => ({
      key: l.key,
      quantidade: Number(l.quantidade) || 0,
      valorEstimadoVenda: Number(l.valorEstimadoVenda) || 0,
    }));
    const valorVendaTotal = itens.reduce((acc, i) => acc + i.quantidade * i.valorEstimadoVenda, 0);
    const valorCompraTotal =
      modoCalculo === "taxa"
        ? valorVendaTotal * (1 - (Number(taxaRevenda) || 0) / 100)
        : Number(valorCompraTotalInformado) || 0;
    const taxaEfetiva = valorVendaTotal > 0 ? (1 - valorCompraTotal / valorVendaTotal) * 100 : 0;

    const porItem = new Map<string, { fator: number; custoCompraUnitario: number; custoCompraTotal: number }>();
    for (const item of itens) {
      const valorLinha = item.quantidade * item.valorEstimadoVenda;
      const fator = valorVendaTotal > 0 ? valorLinha / valorVendaTotal : 0;
      const custoCompraTotal = fator * valorCompraTotal;
      const custoCompraUnitario = item.quantidade > 0 ? custoCompraTotal / item.quantidade : 0;
      porItem.set(item.key, { fator, custoCompraUnitario, custoCompraTotal });
    }

    return { valorVendaTotal, valorCompraTotal, taxaEfetiva, porItem };
  }, [linhas, modoCalculo, taxaRevenda, valorCompraTotalInformado]);

  return (
    <form action={formAction} className="max-w-lg space-y-6">
      <input type="hidden" name="itens" value={itensSerializados} />
      <input type="hidden" name="modoCalculo" value={modoCalculo} />

      <div className="space-y-2">
        <Label htmlFor="descricao" className={labelClass}>Descrição</Label>
        <Input
          id="descricao"
          name="descricao"
          placeholder="Ex.: Som de Fulano"
          defaultValue={defaultValues?.descricao ?? ""}
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="depositoId" className={labelClass}>Depósito de Entrada</Label>
        <Select
          name="depositoId"
          defaultValue={defaultValues?.depositoId ?? depositoPadraoId ?? undefined}
          items={depositosItems}
        >
          <SelectTrigger id="depositoId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione o depósito" />
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

      <div className="space-y-2">
        <Label htmlFor="fornecedorId" className={labelClass}>Fornecedor (opcional)</Label>
        <Select name="fornecedorId" defaultValue={defaultValues?.fornecedorId ?? undefined} items={fornecedoresItems}>
          <SelectTrigger id="fornecedorId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Nenhum" />
          </SelectTrigger>
          <SelectContent>
            {fornecedores.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <Label className={labelClass}>Como calcular o valor de compra</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={modoCalculo === "taxa" ? "default" : "outline"}
            size="sm"
            onClick={() => setModoCalculo("taxa")}
          >
            Por taxa de revenda
          </Button>
          <Button
            type="button"
            variant={modoCalculo === "valor_total" ? "default" : "outline"}
            size="sm"
            onClick={() => setModoCalculo("valor_total")}
          >
            Por valor total
          </Button>
        </div>

        {modoCalculo === "taxa" ? (
          <div className="space-y-1">
            <Label htmlFor="taxaRevenda" className="text-xs">Taxa de Revenda (%)</Label>
            <Input
              id="taxaRevenda"
              name="taxaRevenda"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={taxaRevenda}
              onChange={(e) => setTaxaRevenda(e.target.value)}
              className="h-10 bg-background"
            />
            <p className="text-xs text-muted-foreground">
              Desconto sobre o total estimado de venda: valor de compra = venda × (1 − taxa/100).
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="valorCompraTotalInformado" className="text-xs">Valor Total de Compra (R$)</Label>
            <Input
              id="valorCompraTotalInformado"
              name="valorCompraTotalInformado"
              type="number"
              step="0.01"
              min="0"
              value={valorCompraTotalInformado}
              onChange={(e) => setValorCompraTotalInformado(e.target.value)}
              className="h-10 bg-background"
            />
            <p className="text-xs text-muted-foreground">
              Quanto você pretende pagar no total pelos itens abaixo.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className={labelClass}>Itens</Label>
          <Button type="button" variant="outline" size="sm" onClick={adicionarLinha}>
            + Produto
          </Button>
        </div>

        {linhas.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nenhum item adicionado.
          </p>
        )}

        <ul className="space-y-3">
          {linhas.map((linha) => {
            const calc = preview.porItem.get(linha.key);
            return (
              <li key={linha.key} className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase text-muted-foreground">Produto</span>
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
                  items={produtos}
                  value={linha.produto}
                  onValueChange={(item: Item | null) => atualizarLinha(linha.key, { produto: item })}
                  itemToStringLabel={(item: Item) => item.label}
                  itemToStringValue={(item: Item) => item.id}
                >
                  <ComboboxInputGroup>
                    <ComboboxInput placeholder="Buscar por descrição ou SKU..." />
                    <ComboboxIcon />
                  </ComboboxInputGroup>
                  <ComboboxContent>
                    <ComboboxEmpty>Nenhum produto encontrado.</ComboboxEmpty>
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
                      className="h-10 bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor Est. Venda (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={linha.valorEstimadoVenda}
                      onChange={(e) => atualizarLinha(linha.key, { valorEstimadoVenda: e.target.value })}
                      className="h-10 bg-background"
                    />
                  </div>
                </div>

                {calc && (
                  <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Fator {formatarPercentual(calc.fator * 100)}</span>
                    <span className="font-semibold">Custo compra: {formatarMoeda(calc.custoCompraUnitario)}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total estimado de venda</span>
          <span className="font-semibold">{formatarMoeda(preview.valorVendaTotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total de compra (calculado)</span>
          <span className="font-semibold">{formatarMoeda(preview.valorCompraTotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Taxa de revenda efetiva</span>
          <span className="font-semibold">{formatarPercentual(preview.taxaEfetiva)}</span>
        </div>
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Salvar Orçamento"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/orcamentos" />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
