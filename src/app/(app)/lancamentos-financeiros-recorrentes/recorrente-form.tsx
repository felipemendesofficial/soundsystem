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
import { RateioEditor, type ItemRateio, type LinhaRateioEditor, novaChaveRateio } from "@/components/rateio-editor";
import { cn } from "@/lib/utils";
import { TIPOS_DOCUMENTO_LABEL, PERIODICIDADE_LABEL } from "@/lib/financeiro-labels";
import type { RecorrenteFormState } from "./actions";

type Action = (prevState: RecorrenteFormState, formData: FormData) => Promise<RecorrenteFormState>;

type LinhaPlano = { key: string; conta: ItemRateio | null; percentual: string; centroCusto: LinhaRateioEditor[] };

function linhaPlanoVazia(): LinhaPlano {
  return { key: novaChaveRateio(), conta: null, percentual: "100", centroCusto: [] };
}

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export type RecorrenteDefaultValues = {
  tipo: "receita" | "despesa";
  descricao: string;
  clienteId: string | null;
  fornecedorId: string | null;
  tipoDocumento: string;
  contaPrevistaId: string | null;
  processoId: string;
  natureza: "real" | "prevista";
  periodicidade: string;
  diaVencimento: number;
  dataInicio: string;
  dataFim: string;
  rateioPlano: { planoId: string; percentual: string; centroCusto: { centroCustoId: string; percentual: string }[] }[];
  rateioProcesso: { processoItemId: string; percentual: string }[];
};

export function RecorrenteForm({
  action,
  clientes,
  fornecedores,
  contasFinanceiras,
  processos,
  planoFinanceiro,
  centroCusto,
  processoItens,
  defaultValues,
}: {
  action: Action;
  clientes: ItemRateio[];
  fornecedores: ItemRateio[];
  contasFinanceiras: ItemRateio[];
  processos: ItemRateio[];
  planoFinanceiro: { id: string; label: string; tipo: "receita" | "despesa" }[];
  centroCusto: ItemRateio[];
  processoItens: { id: string; label: string; processoId: string }[];
  defaultValues?: RecorrenteDefaultValues;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  const [tipo, setTipo] = useState<"receita" | "despesa">(defaultValues?.tipo ?? "despesa");
  const [natureza, setNatureza] = useState<"real" | "prevista">(defaultValues?.natureza ?? "real");
  const [tipoDocumento, setTipoDocumento] = useState<string>(defaultValues?.tipoDocumento ?? "especie");
  const [processoId, setProcessoId] = useState<string>(defaultValues?.processoId ?? "");
  const [clienteId, setClienteId] = useState<string | null>(defaultValues?.clienteId ?? null);
  const [fornecedorId, setFornecedorId] = useState<string | null>(defaultValues?.fornecedorId ?? null);
  const [contaPrevistaId, setContaPrevistaId] = useState<string | null>(defaultValues?.contaPrevistaId ?? null);
  const [periodicidade, setPeriodicidade] = useState<string>(defaultValues?.periodicidade ?? "mensal");

  const [descricao, setDescricao] = useState(defaultValues?.descricao ?? "");
  const [diaVencimento, setDiaVencimento] = useState(defaultValues?.diaVencimento?.toString() ?? "");
  const [dataInicio, setDataInicio] = useState(defaultValues?.dataInicio ?? "");
  const [dataFim, setDataFim] = useState(defaultValues?.dataFim ?? "");

  const [rateioPlano, setRateioPlano] = useState<LinhaPlano[]>(() =>
    (defaultValues?.rateioPlano ?? []).map((l) => ({
      key: novaChaveRateio(),
      conta: planoFinanceiro.find((p) => p.id === l.planoId) ?? null,
      percentual: l.percentual,
      centroCusto: l.centroCusto.map((cc) => ({
        key: novaChaveRateio(),
        conta: centroCusto.find((c) => c.id === cc.centroCustoId) ?? null,
        percentual: cc.percentual,
      })),
    }))
  );
  const [rateioProcesso, setRateioProcesso] = useState<LinhaRateioEditor[]>(() =>
    (defaultValues?.rateioProcesso ?? []).map((l) => ({
      key: novaChaveRateio(),
      conta: processoItens.find((i) => i.id === l.processoItemId) ?? null,
      percentual: l.percentual,
    }))
  );

  const itensContas = Object.fromEntries(contasFinanceiras.map((c) => [c.id, c.label]));
  const itensProcessos = Object.fromEntries(processos.map((p) => [p.id, p.label]));
  const planoFinanceiroFiltrado = planoFinanceiro.filter((p) => p.tipo === tipo).map((p) => ({ id: p.id, label: p.label }));
  const processoItensFiltrados = processoItens.filter((i) => i.processoId === processoId).map((i) => ({ id: i.id, label: i.label }));

  function adicionarLinhaPlano() {
    setRateioPlano((atual) => [...atual, linhaPlanoVazia()]);
  }
  function removerLinhaPlano(key: string) {
    setRateioPlano((atual) => atual.filter((l) => l.key !== key));
  }
  function atualizarLinhaPlano(key: string, patch: Partial<LinhaPlano>) {
    setRateioPlano((atual) => atual.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const totalPlano = rateioPlano.reduce((acc, l) => acc + (Number(l.percentual) || 0), 0);
  const planoFechado = Math.abs(totalPlano - 100) < 0.01;

  const rateioPlanoSerializado = JSON.stringify(
    rateioPlano
      .filter((l) => l.conta)
      .map((l) => ({
        planoId: l.conta!.id,
        percentual: l.percentual,
        centroCusto: l.centroCusto.filter((cc) => cc.conta).map((cc) => ({ centroCustoId: cc.conta!.id, percentual: cc.percentual })),
      }))
  );
  const rateioProcessoSerializado = JSON.stringify(
    rateioProcesso.filter((l) => l.conta).map((l) => ({ processoItemId: l.conta!.id, percentual: l.percentual }))
  );

  return (
    <form action={formAction} className="max-w-lg space-y-6">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="natureza" value={natureza} />
      <input type="hidden" name="tipoDocumento" value={tipoDocumento} />
      <input type="hidden" name="processoId" value={processoId} />
      <input type="hidden" name="clienteId" value={clienteId ?? ""} />
      <input type="hidden" name="fornecedorId" value={fornecedorId ?? ""} />
      <input type="hidden" name="contaPrevistaId" value={contaPrevistaId ?? ""} />
      <input type="hidden" name="periodicidade" value={periodicidade} />
      <input type="hidden" name="rateioPlano" value={rateioPlanoSerializado} />
      <input type="hidden" name="rateioProcesso" value={rateioProcessoSerializado} />

      <div className="space-y-2">
        <Label htmlFor="descricao" className={labelClass}>Descrição</Label>
        <Input
          id="descricao"
          name="descricao"
          required
          placeholder="Água, Luz, Telefone, Contador, Aluguel..."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={tipo === "despesa" ? "default" : "outline"} disabled={!!defaultValues} onClick={() => { setTipo("despesa"); setClienteId(null); }}>
          Despesa
        </Button>
        <Button type="button" variant={tipo === "receita" ? "default" : "outline"} disabled={!!defaultValues} onClick={() => { setTipo("receita"); setFornecedorId(null); }}>
          Receita
        </Button>
      </div>
      {defaultValues && (
        <p className="-mt-4 text-xs text-muted-foreground">Tipo não pode ser alterado depois de criado.</p>
      )}

      <div className="space-y-2">
        <Label className={labelClass}>{tipo === "despesa" ? "Fornecedor" : "Cliente"}</Label>
        <Combobox
          items={tipo === "despesa" ? fornecedores : clientes}
          value={tipo === "despesa" ? (fornecedores.find((f) => f.id === fornecedorId) ?? null) : (clientes.find((c) => c.id === clienteId) ?? null)}
          onValueChange={(item: ItemRateio | null) => (tipo === "despesa" ? setFornecedorId(item?.id ?? null) : setClienteId(item?.id ?? null))}
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="tipoDocumentoSelect" className={labelClass}>Tipo de Documento</Label>
        <Select value={tipoDocumento} items={TIPOS_DOCUMENTO_LABEL} onValueChange={(v) => v && setTipoDocumento(v)}>
          <SelectTrigger id="tipoDocumentoSelect" className={`w-full ${inputClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TIPOS_DOCUMENTO_LABEL).map(([valor, rotulo]) => (
              <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className={labelClass}>Natureza</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={natureza === "real" ? "default" : "outline"} onClick={() => setNatureza("real")}>Real</Button>
          <Button type="button" variant={natureza === "prevista" ? "default" : "outline"} onClick={() => setNatureza("prevista")}>Previsão</Button>
        </div>
        <p className="text-xs text-muted-foreground">Natureza com a qual cada geração nasce.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="periodicidadeSelect" className={labelClass}>Periodicidade</Label>
          <Select value={periodicidade} items={PERIODICIDADE_LABEL} onValueChange={(v) => v && setPeriodicidade(v)}>
            <SelectTrigger id="periodicidadeSelect" className={`w-full ${inputClass}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIODICIDADE_LABEL).map(([valor, rotulo]) => (
                <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="diaVencimento" className={labelClass}>Dia de Vencimento</Label>
          <Input
            id="diaVencimento"
            name="diaVencimento"
            type="number"
            min="1"
            max="31"
            required
            value={diaVencimento}
            onChange={(e) => setDiaVencimento(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="dataInicio" className={labelClass}>Início</Label>
          <Input id="dataInicio" name="dataInicio" type="date" required value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dataFim" className={labelClass}>Fim (opcional)</Label>
          <Input id="dataFim" name="dataFim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="processoIdSelect" className={labelClass}>Processo</Label>
        <Select value={processoId} items={itensProcessos} onValueChange={(v) => v && setProcessoId(v)}>
          <SelectTrigger id="processoIdSelect" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {processos.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contaPrevistaId" className={labelClass}>Conta Prevista (opcional)</Label>
        <Select value={contaPrevistaId ?? ""} items={itensContas} onValueChange={(v) => setContaPrevistaId(v || null)}>
          <SelectTrigger id="contaPrevistaId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Nenhuma" />
          </SelectTrigger>
          <SelectContent>
            {contasFinanceiras.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className={labelClass}>Rateio — Plano Financeiro</Label>
          <button type="button" onClick={adicionarLinhaPlano} className="text-sm font-medium text-primary">+ Linha</button>
        </div>

        <ul className="space-y-3">
          {rateioPlano.map((linha) => (
            <li key={linha.key} className="space-y-2 rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Combobox
                    items={planoFinanceiroFiltrado}
                    value={linha.conta}
                    onValueChange={(item: ItemRateio | null) => atualizarLinhaPlano(linha.key, { conta: item })}
                    itemToStringLabel={(item: ItemRateio) => item.label}
                    itemToStringValue={(item: ItemRateio) => item.id}
                  >
                    <ComboboxInputGroup>
                      <ComboboxInput placeholder="Buscar conta..." />
                      <ComboboxIcon />
                    </ComboboxInputGroup>
                    <ComboboxContent>
                      <ComboboxEmpty>Nenhuma conta encontrada.</ComboboxEmpty>
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
                  max="100"
                  placeholder="%"
                  value={linha.percentual}
                  onChange={(e) => atualizarLinhaPlano(linha.key, { percentual: e.target.value })}
                  className="h-9 w-20 flex-none text-center"
                  aria-label="Percentual"
                />
                <button type="button" onClick={() => removerLinhaPlano(linha.key)} className="flex-none text-destructive" aria-label="Remover linha">
                  <Trash2 className="size-4" />
                </button>
              </div>

              <RateioEditor
                titulo="Centro de Custo (opcional)"
                itens={centroCusto}
                linhas={linha.centroCusto}
                onChange={(novasLinhas) => atualizarLinhaPlano(linha.key, { centroCusto: novasLinhas })}
                exigirSoma100={linha.centroCusto.length > 0}
                placeholderBusca="Buscar centro de custo..."
                percentualPadrao="100"
              />
            </li>
          ))}
        </ul>

        {rateioPlano.length > 0 && (
          <p className={cn("text-xs", planoFechado ? "text-muted-foreground" : "font-medium text-destructive")}>
            Total: {totalPlano.toFixed(2)}% {!planoFechado && "— deve somar 100%"}
          </p>
        )}
      </div>

      <RateioEditor
        titulo="Rateio — Processo"
        itens={processoItensFiltrados}
        linhas={rateioProcesso}
        onChange={setRateioProcesso}
        placeholderBusca="Buscar item do processo..."
        vazio="Selecione um processo com itens cadastrados."
        percentualPadrao="100"
      />

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : defaultValues ? "Salvar alterações" : "Salvar"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/lancamentos-financeiros-recorrentes" />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
