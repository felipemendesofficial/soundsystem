"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { TIPOS_DOCUMENTO_LABEL } from "@/lib/financeiro-labels";
import { cn } from "@/lib/utils";
import type { RenegociacaoFormState } from "./actions";

type Action = (prevState: RenegociacaoFormState, formData: FormData) => Promise<RenegociacaoFormState>;

type OrigemDisponivel = { id: string; tipo: "receita" | "despesa"; label: string; valor: number; vencimento: string };

type LinhaDestino = {
  key: string;
  descricao: string;
  contraparteId: string | null;
  tipoDocumento: string;
  processoId: string;
  processoItemId: string;
  dataEmissao: string;
  dataVencimento: string;
  valorOriginal: string;
  juros: string;
  multa: string;
  desconto: string;
  justificativaDesconto: string;
};

let contador = 0;
function novaLinhaDestino(): LinhaDestino {
  contador += 1;
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    key: `destino-${contador}`,
    descricao: "",
    contraparteId: null,
    tipoDocumento: "especie",
    processoId: "",
    processoItemId: "",
    dataEmissao: hoje,
    dataVencimento: hoje,
    valorOriginal: "",
    juros: "0",
    multa: "0",
    desconto: "0",
    justificativaDesconto: "",
  };
}

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function RenegociacaoForm({
  action,
  origensDisponiveis,
  clientes,
  fornecedores,
  processos,
  processoItens,
}: {
  action: Action;
  origensDisponiveis: OrigemDisponivel[];
  clientes: ItemRateio[];
  fornecedores: ItemRateio[];
  processos: ItemRateio[];
  processoItens: { id: string; label: string; processoId: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, {});

  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [motivo, setMotivo] = useState("");
  const [origensSelecionadas, setOrigensSelecionadas] = useState<Set<string>>(new Set());
  const [destinos, setDestinos] = useState<LinhaDestino[]>([novaLinhaDestino()]);

  const origensDoTipo = origensDisponiveis.filter((o) => o.tipo === tipo);
  const totalOrigens = origensDoTipo
    .filter((o) => origensSelecionadas.has(o.id))
    .reduce((acc, o) => acc + o.valor, 0);

  function alternarOrigem(id: string) {
    setOrigensSelecionadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function atualizarDestino(key: string, patch: Partial<LinhaDestino>) {
    setDestinos((atual) => atual.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }
  function removerDestino(key: string) {
    setDestinos((atual) => atual.filter((d) => d.key !== key));
  }

  const totalDestinos = destinos.reduce((acc, d) => acc + (Number(d.valorOriginal) || 0), 0);
  const totalAjustes = destinos.reduce((acc, d) => acc + (Number(d.juros) || 0) + (Number(d.multa) || 0) - (Number(d.desconto) || 0), 0);
  const totalEsperado = totalOrigens + totalAjustes;
  const fecha = Math.abs(totalDestinos - totalEsperado) < 0.01 && totalOrigens > 0;

  const contrapartes = tipo === "despesa" ? fornecedores : clientes;

  const destinosSerializados = useMemo(
    () =>
      JSON.stringify(
        destinos.map((d) => ({
          descricao: d.descricao,
          clienteId: tipo === "receita" ? d.contraparteId : undefined,
          fornecedorId: tipo === "despesa" ? d.contraparteId : undefined,
          tipoDocumento: d.tipoDocumento,
          processoId: d.processoId,
          processoItemId: d.processoItemId,
          dataEmissao: d.dataEmissao,
          dataVencimento: d.dataVencimento,
          valorOriginal: d.valorOriginal,
          juros: d.juros,
          multa: d.multa,
          desconto: d.desconto,
          justificativaDesconto: d.justificativaDesconto,
        }))
      ),
    [destinos, tipo]
  );

  return (
    <form action={formAction} className="max-w-lg space-y-6">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="destinos" value={destinosSerializados} />
      {Array.from(origensSelecionadas).map((id) => (
        <input key={id} type="hidden" name="origensIds" value={id} />
      ))}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={tipo === "despesa" ? "default" : "outline"} onClick={() => { setTipo("despesa"); setOrigensSelecionadas(new Set()); }}>
          Despesa
        </Button>
        <Button type="button" variant={tipo === "receita" ? "default" : "outline"} onClick={() => { setTipo("receita"); setOrigensSelecionadas(new Set()); }}>
          Receita
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="motivo" className={labelClass}>Motivo</Label>
        <Input id="motivo" name="motivo" required value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputClass} />
      </div>

      <div className="space-y-2">
        <Label className={labelClass}>Títulos de Origem ({tipo === "despesa" ? "despesas" : "receitas"} em aberto)</Label>
        {origensDoTipo.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nenhum título em aberto desse tipo.
          </p>
        ) : (
          <ul className="space-y-2">
            {origensDoTipo.map((o) => (
              <li key={o.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <Checkbox checked={origensSelecionadas.has(o.id)} onCheckedChange={() => alternarOrigem(o.id)} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{o.label}</div>
                  <div className="text-xs text-muted-foreground">Venc. {new Date(o.vencimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</div>
                </div>
                <div className="flex-none text-sm font-semibold">{formatarMoeda(o.valor)}</div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm font-medium">Total das origens: {formatarMoeda(totalOrigens)}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className={labelClass}>Títulos de Destino</Label>
          <button type="button" onClick={() => setDestinos((atual) => [...atual, novaLinhaDestino()])} className="text-sm font-medium text-primary">
            + Título
          </button>
        </div>

        <ul className="space-y-3">
          {destinos.map((destino) => {
            const itensDoProcesso = processoItens.filter((i) => i.processoId === destino.processoId);
            return (
              <li key={destino.key} className="space-y-3 rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Título de destino</span>
                  {destinos.length > 1 && (
                    <button type="button" onClick={() => removerDestino(destino.key)} className="text-destructive" aria-label="Remover título">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>

                <Input
                  placeholder="Histórico"
                  value={destino.descricao}
                  onChange={(e) => atualizarDestino(destino.key, { descricao: e.target.value })}
                  className="h-10 bg-background"
                />

                <Combobox
                  items={contrapartes}
                  value={contrapartes.find((c) => c.id === destino.contraparteId) ?? null}
                  onValueChange={(item: ItemRateio | null) => atualizarDestino(destino.key, { contraparteId: item?.id ?? null })}
                  itemToStringLabel={(item: ItemRateio) => item.label}
                  itemToStringValue={(item: ItemRateio) => item.id}
                >
                  <ComboboxInputGroup>
                    <ComboboxInput placeholder={`Buscar ${tipo === "despesa" ? "fornecedor" : "cliente"}...`} />
                    <ComboboxIcon />
                  </ComboboxInputGroup>
                  <ComboboxContent>
                    <ComboboxEmpty>Nenhum resultado.</ComboboxEmpty>
                    <ComboboxList>
                      {(item: ItemRateio) => <ComboboxItem key={item.id} value={item}>{item.label}</ComboboxItem>}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>

                <Select value={destino.tipoDocumento} items={TIPOS_DOCUMENTO_LABEL} onValueChange={(v) => v && atualizarDestino(destino.key, { tipoDocumento: v })}>
                  <SelectTrigger className="h-10 w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPOS_DOCUMENTO_LABEL).map(([valor, rotulo]) => (
                      <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={destino.processoId}
                  items={Object.fromEntries(processos.map((p) => [p.id, p.label]))}
                  onValueChange={(v) => {
                    if (!v) return;
                    const itens = processoItens.filter((i) => i.processoId === v);
                    atualizarDestino(destino.key, { processoId: v, processoItemId: itens.length === 1 ? itens[0].id : "" });
                  }}
                >
                  <SelectTrigger className="h-10 w-full bg-background">
                    <SelectValue placeholder="Processo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {processos.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>

                {destino.processoId && (
                  <Select
                    value={destino.processoItemId}
                    items={Object.fromEntries(itensDoProcesso.map((i) => [i.id, i.label]))}
                    onValueChange={(v) => v && atualizarDestino(destino.key, { processoItemId: v })}
                  >
                    <SelectTrigger className="h-10 w-full bg-background">
                      <SelectValue placeholder="Item do processo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {itensDoProcesso.map((i) => <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={destino.dataEmissao} onChange={(e) => atualizarDestino(destino.key, { dataEmissao: e.target.value })} className="h-10 bg-background" />
                  <Input type="date" value={destino.dataVencimento} min={destino.dataEmissao} onChange={(e) => atualizarDestino(destino.key, { dataVencimento: e.target.value })} className="h-10 bg-background" />
                </div>

                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Valor (R$)"
                  value={destino.valorOriginal}
                  onChange={(e) => atualizarDestino(destino.key, { valorOriginal: e.target.value })}
                  className="h-10 bg-background"
                />

                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" step="0.01" min="0" placeholder="Juros" value={destino.juros} onChange={(e) => atualizarDestino(destino.key, { juros: e.target.value })} className="h-10 bg-background" />
                  <Input type="number" step="0.01" min="0" placeholder="Multa" value={destino.multa} onChange={(e) => atualizarDestino(destino.key, { multa: e.target.value })} className="h-10 bg-background" />
                  <Input type="number" step="0.01" min="0" placeholder="Desconto" value={destino.desconto} onChange={(e) => atualizarDestino(destino.key, { desconto: e.target.value })} className="h-10 bg-background" />
                </div>

                {Number(destino.desconto) > 0 && (
                  <Input
                    placeholder="Justificativa do desconto"
                    value={destino.justificativaDesconto}
                    onChange={(e) => atualizarDestino(destino.key, { justificativaDesconto: e.target.value })}
                    className="h-10 bg-background"
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Total das origens</span><span>{formatarMoeda(totalOrigens)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Juros + multa − desconto</span><span>{formatarMoeda(totalAjustes)}</span></div>
        <div className="flex justify-between font-medium"><span>Esperado nos destinos</span><span>{formatarMoeda(totalEsperado)}</span></div>
        <div className={cn("flex justify-between font-medium", fecha ? "text-primary" : "text-destructive")}>
          <span>Soma dos destinos</span><span>{formatarMoeda(totalDestinos)}</span>
        </div>
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending || !fecha} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Confirmar Renegociação"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/renegociacoes" />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
