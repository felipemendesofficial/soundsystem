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
import type { ItemRateio } from "@/components/rateio-editor";
import type { OrdemProducaoFormState } from "./actions";

type Action = (prevState: OrdemProducaoFormState, formData: FormData) => Promise<OrdemProducaoFormState>;

type LinhaMaterial = { key: string; produto: ItemRateio | null; depositoId: string; quantidade: string };
type LinhaServico = { key: string; servico: ItemRateio | null; valor: string };

let contador = 0;
function novaChave() {
  contador += 1;
  return `linha-${contador}`;
}

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function OrdemProducaoForm({
  action,
  depositos,
  produtos,
  servicos,
}: {
  action: Action;
  depositos: ItemRateio[];
  produtos: ItemRateio[];
  servicos: ItemRateio[];
}) {
  const [state, formAction, pending] = useActionState(action, {});

  const depositoUnico = depositos.length === 1 ? depositos[0].id : "";
  const [depositoEntradaId, setDepositoEntradaId] = useState(depositoUnico);
  const [produtoFinal, setProdutoFinal] = useState<ItemRateio | null>(null);
  const [quantidadeEntrada, setQuantidadeEntrada] = useState("");

  const [materiais, setMateriais] = useState<LinhaMaterial[]>([]);
  const [servicosLinhas, setServicosLinhas] = useState<LinhaServico[]>([]);

  function adicionarMaterial() {
    setMateriais((atual) => [...atual, { key: novaChave(), produto: null, depositoId: depositoUnico, quantidade: "" }]);
  }
  function atualizarMaterial(key: string, patch: Partial<LinhaMaterial>) {
    setMateriais((atual) => atual.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  }
  function removerMaterial(key: string) {
    setMateriais((atual) => atual.filter((m) => m.key !== key));
  }

  function adicionarServico() {
    setServicosLinhas((atual) => [...atual, { key: novaChave(), servico: null, valor: "" }]);
  }
  function atualizarServico(key: string, patch: Partial<LinhaServico>) {
    setServicosLinhas((atual) => atual.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }
  function removerServico(key: string) {
    setServicosLinhas((atual) => atual.filter((s) => s.key !== key));
  }

  const itensDepositos = Object.fromEntries(depositos.map((d) => [d.id, d.label]));

  const materiaisSerializados = JSON.stringify(
    materiais.filter((m) => m.produto && m.depositoId && m.quantidade).map((m) => ({ produtoId: m.produto!.id, depositoId: m.depositoId, quantidade: m.quantidade }))
  );
  const servicosSerializados = JSON.stringify(
    servicosLinhas.filter((s) => s.servico && s.valor).map((s) => ({ servicoId: s.servico!.id, valor: s.valor }))
  );

  return (
    <form action={formAction} className="max-w-lg space-y-6">
      <input type="hidden" name="depositoEntradaId" value={depositoEntradaId} />
      <input type="hidden" name="produtoFinalId" value={produtoFinal?.id ?? ""} />
      <input type="hidden" name="materiais" value={materiaisSerializados} />
      <input type="hidden" name="servicos" value={servicosSerializados} />

      <div className="space-y-2">
        <Label className={labelClass}>Depósito de Entrada (produto final)</Label>
        <Select value={depositoEntradaId} items={itensDepositos} onValueChange={(v) => v && setDepositoEntradaId(v)}>
          <SelectTrigger className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {depositos.map((d) => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className={labelClass}>Produto Final</Label>
        <Combobox
          items={produtos}
          value={produtoFinal}
          onValueChange={setProdutoFinal}
          itemToStringLabel={(item: ItemRateio) => item.label}
          itemToStringValue={(item: ItemRateio) => item.id}
        >
          <ComboboxInputGroup>
            <ComboboxInput placeholder="Buscar produto..." />
            <ComboboxIcon />
          </ComboboxInputGroup>
          <ComboboxContent>
            <ComboboxEmpty>Nenhum produto encontrado.</ComboboxEmpty>
            <ComboboxList>
              {(item: ItemRateio) => <ComboboxItem key={item.id} value={item}>{item.label}</ComboboxItem>}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quantidadeEntrada" className={labelClass}>Quantidade de Entrada</Label>
        <Input
          id="quantidadeEntrada"
          name="quantidadeEntrada"
          type="number"
          step="0.001"
          min="0.001"
          required
          value={quantidadeEntrada}
          onChange={(e) => setQuantidadeEntrada(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className={labelClass}>Materiais</Label>
          <button type="button" onClick={adicionarMaterial} className="text-sm font-medium text-primary">+ Material</button>
        </div>
        <ul className="space-y-2">
          {materiais.map((linha) => (
            <li key={linha.key} className="space-y-2 rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Combobox
                    items={produtos}
                    value={linha.produto}
                    onValueChange={(item: ItemRateio | null) => atualizarMaterial(linha.key, { produto: item })}
                    itemToStringLabel={(item: ItemRateio) => item.label}
                    itemToStringValue={(item: ItemRateio) => item.id}
                  >
                    <ComboboxInputGroup>
                      <ComboboxInput placeholder="Buscar produto..." />
                      <ComboboxIcon />
                    </ComboboxInputGroup>
                    <ComboboxContent>
                      <ComboboxEmpty>Nenhum produto encontrado.</ComboboxEmpty>
                      <ComboboxList>
                        {(item: ItemRateio) => <ComboboxItem key={item.id} value={item}>{item.label}</ComboboxItem>}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>
                <button type="button" onClick={() => removerMaterial(linha.key)} className="flex-none text-destructive" aria-label="Remover material">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={linha.depositoId} items={itensDepositos} onValueChange={(v) => v && atualizarMaterial(linha.key, { depositoId: v })}>
                  <SelectTrigger className="h-10 w-full bg-background">
                    <SelectValue placeholder="Depósito de saída..." />
                  </SelectTrigger>
                  <SelectContent>
                    {depositos.map((d) => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="Quantidade"
                  value={linha.quantidade}
                  onChange={(e) => atualizarMaterial(linha.key, { quantidade: e.target.value })}
                  className="h-10 bg-background"
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          O mesmo produto pode aparecer em mais de uma linha com depósitos diferentes.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className={labelClass}>Serviços (opcional)</Label>
          <button type="button" onClick={adicionarServico} className="text-sm font-medium text-primary">+ Serviço</button>
        </div>
        <ul className="space-y-2">
          {servicosLinhas.map((linha) => (
            <li key={linha.key} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <Combobox
                  items={servicos}
                  value={linha.servico}
                  onValueChange={(item: ItemRateio | null) => atualizarServico(linha.key, { servico: item })}
                  itemToStringLabel={(item: ItemRateio) => item.label}
                  itemToStringValue={(item: ItemRateio) => item.id}
                >
                  <ComboboxInputGroup>
                    <ComboboxInput placeholder="Buscar serviço..." />
                    <ComboboxIcon />
                  </ComboboxInputGroup>
                  <ComboboxContent>
                    <ComboboxEmpty>Nenhum serviço encontrado.</ComboboxEmpty>
                    <ComboboxList>
                      {(item: ItemRateio) => <ComboboxItem key={item.id} value={item}>{item.label}</ComboboxItem>}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Valor (R$)"
                value={linha.valor}
                onChange={(e) => atualizarServico(linha.key, { valor: e.target.value })}
                className="h-10 w-32 flex-none bg-background"
              />
              <button type="button" onClick={() => removerServico(linha.key)} className="flex-none text-destructive" aria-label="Remover serviço">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/ordens-producao" />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
