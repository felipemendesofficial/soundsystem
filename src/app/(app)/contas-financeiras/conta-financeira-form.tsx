"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
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
import type { ContaFinanceiraFormState } from "./actions";

type Action = (prevState: ContaFinanceiraFormState, formData: FormData) => Promise<ContaFinanceiraFormState>;

type ItemBanco = { id: string; label: string };

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

const TIPOS = {
  conta_corrente: "Conta Corrente",
  caixa: "Caixa",
  fundo_fixo: "Fundo Fixo",
  aplicacao: "Aplicação",
};

export function ContaFinanceiraForm({
  action,
  bancos,
  defaultValues,
}: {
  action: Action;
  bancos: ItemBanco[];
  defaultValues?: {
    tipo: string;
    nome: string;
    numeroConta: string | null;
    agencia: string | null;
    bancoId: string | null;
    limiteCredito: string | number | null;
    dataAbertura: string | null; // "YYYY-MM-DD", já formatada
    valorFundoFixo: string | number | null;
    saldoInicial: string | number;
    saldoAtual?: string | number; // só em edição — exibido, nunca editável
    gerarBoleto: boolean;
    adiantamentoCliente: boolean;
    adiantamentoFornecedor: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [banco, setBanco] = useState<ItemBanco | null>(
    defaultValues?.bancoId ? bancos.find((b) => b.id === defaultValues.bancoId) ?? null : null
  );

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <div className="space-y-2">
        <Label htmlFor="tipo" className={labelClass}>Tipo</Label>
        <Select name="tipo" items={TIPOS} defaultValue={defaultValues?.tipo ?? "conta_corrente"}>
          <SelectTrigger id="tipo" className={`w-full ${inputClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TIPOS).map(([valor, rotulo]) => (
              <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nome" className={labelClass}>Nome</Label>
        <Input id="nome" name="nome" required defaultValue={defaultValues?.nome} className={inputClass} />
      </div>

      <input type="hidden" name="bancoId" value={banco?.id ?? ""} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className={labelClass}>Banco</Label>
          <Combobox
            items={bancos}
            value={banco}
            onValueChange={setBanco}
            itemToStringLabel={(item: ItemBanco) => item.label}
            itemToStringValue={(item: ItemBanco) => item.id}
          >
            <ComboboxInputGroup>
              <ComboboxInput placeholder="Buscar banco..." />
              <ComboboxIcon />
            </ComboboxInputGroup>
            <ComboboxContent>
              <ComboboxEmpty>Nenhum banco encontrado.</ComboboxEmpty>
              <ComboboxList>
                {(item: ItemBanco) => (
                  <ComboboxItem key={item.id} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
        <div className="space-y-2">
          <Label htmlFor="agencia" className={labelClass}>Agência</Label>
          <Input id="agencia" name="agencia" defaultValue={defaultValues?.agencia ?? ""} className={inputClass} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="numeroConta" className={labelClass}>Número da Conta</Label>
        <Input id="numeroConta" name="numeroConta" defaultValue={defaultValues?.numeroConta ?? ""} className={inputClass} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dataAbertura" className={labelClass}>Data de Abertura</Label>
        <Input id="dataAbertura" name="dataAbertura" type="date" defaultValue={defaultValues?.dataAbertura ?? ""} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="limiteCredito" className={labelClass}>Limite de Crédito (R$)</Label>
          <Input
            id="limiteCredito"
            name="limiteCredito"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.limiteCredito ?? ""}
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valorFundoFixo" className={labelClass}>Teto do Fundo Fixo (R$)</Label>
          <Input
            id="valorFundoFixo"
            name="valorFundoFixo"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.valorFundoFixo ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="saldoInicial" className={labelClass}>Saldo Inicial (R$)</Label>
        <Input
          id="saldoInicial"
          name="saldoInicial"
          type="number"
          step="0.01"
          defaultValue={defaultValues?.saldoInicial ?? 0}
          className={inputClass}
        />
        {defaultValues?.saldoAtual !== undefined && (
          <p className="text-[13px] text-muted-foreground">
            Saldo atual: <span className="font-medium text-foreground">{defaultValues.saldoAtual}</span> — atualizado só pelas movimentações, não por aqui.
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Checkbox id="gerarBoleto" name="gerarBoleto" defaultChecked={defaultValues?.gerarBoleto ?? false} />
          <Label htmlFor="gerarBoleto" className={labelClass}>Gera boleto</Label>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox id="adiantamentoCliente" name="adiantamentoCliente" defaultChecked={defaultValues?.adiantamentoCliente ?? false} />
          <Label htmlFor="adiantamentoCliente" className={labelClass}>Controle de adiantamento de Cliente</Label>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox id="adiantamentoFornecedor" name="adiantamentoFornecedor" defaultChecked={defaultValues?.adiantamentoFornecedor ?? false} />
          <Label htmlFor="adiantamentoFornecedor" className={labelClass}>Controle de adiantamento de Fornecedor</Label>
        </div>
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/contas-financeiras" />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
