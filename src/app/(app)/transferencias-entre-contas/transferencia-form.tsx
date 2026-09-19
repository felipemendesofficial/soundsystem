"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
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
import { REGRAS_TRANSFERENCIA, erroContaOrigemTransferencia, erroContaDestinoTransferencia } from "@/lib/regras-conta-transferencia";
import type { TipoConta, TipoMovimentoTransferencia } from "@/generated/prisma/client";
import type { TransferenciaFormState } from "./actions";

type Action = (prevState: TransferenciaFormState, formData: FormData) => Promise<TransferenciaFormState>;

type ItemTerceiro = { id: string; label: string };

type ContaTransferencia = {
  id: string;
  label: string;
  tipo: TipoConta;
  adiantamentoCliente: boolean;
  adiantamentoFornecedor: boolean;
};

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

const TIPOS_MOVIMENTO: Record<TipoMovimentoTransferencia, string> = {
  transferencia_geral: "Transferência Geral",
  reposicao_fundo_fixo: "Reposição de Fundo Fixo",
  saldo_caixa_banco: "Saldo Caixa/Banco",
  emprestimo_contraido_banco: "Empréstimo Contraído no Banco",
  transferencia_entre_caixas: "Transferência entre Caixas",
  transferencia_banco_para_caixa: "Transferência Banco → Caixa",
};

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function TerceiroPicker({
  label,
  terceiros,
  valor,
  onChange,
}: {
  label: string;
  terceiros: ItemTerceiro[];
  valor: ItemTerceiro | null;
  onChange: (item: ItemTerceiro | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className={labelClass}>{label}</Label>
      <Combobox
        items={terceiros}
        value={valor}
        onValueChange={onChange}
        itemToStringLabel={(item: ItemTerceiro) => item.label}
        itemToStringValue={(item: ItemTerceiro) => item.id}
      >
        <ComboboxInputGroup>
          <ComboboxInput placeholder="Buscar..." />
          <ComboboxIcon />
        </ComboboxInputGroup>
        <ComboboxContent>
          <ComboboxEmpty>Nenhum resultado.</ComboboxEmpty>
          <ComboboxList>
            {(item: ItemTerceiro) => (
              <ComboboxItem key={item.id} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

export function TransferenciaForm({
  action,
  cancelarHref,
  contas,
  clientes,
  fornecedores,
}: {
  action: Action;
  cancelarHref: string;
  contas: ContaTransferencia[];
  clientes: ItemTerceiro[];
  fornecedores: ItemTerceiro[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [tipoMovimento, setTipoMovimento] = useState<TipoMovimentoTransferencia>("transferencia_geral");
  const [contaOrigemId, setContaOrigemId] = useState("");
  const [contaDestinoId, setContaDestinoId] = useState("");
  const [origemTerceiro, setOrigemTerceiro] = useState<ItemTerceiro | null>(null);
  const [destinoTerceiro, setDestinoTerceiro] = useState<ItemTerceiro | null>(null);

  const regra = REGRAS_TRANSFERENCIA[tipoMovimento];

  const contasOrigem = useMemo(
    () => contas.filter((c) => !erroContaOrigemTransferencia(c, tipoMovimento)),
    [contas, tipoMovimento]
  );
  const contasDestino = useMemo(
    () => contas.filter((c) => !erroContaDestinoTransferencia(c, tipoMovimento)),
    [contas, tipoMovimento]
  );
  const itensOrigem = Object.fromEntries(contasOrigem.map((c) => [c.id, c.label]));
  const itensDestino = Object.fromEntries(contasDestino.map((c) => [c.id, c.label]));

  const contaOrigemSelecionada = contasOrigem.find((c) => c.id === contaOrigemId) ?? null;
  const contaDestinoSelecionada = contasDestino.find((c) => c.id === contaDestinoId) ?? null;

  function selecionarTipo(novoTipo: TipoMovimentoTransferencia) {
    setTipoMovimento(novoTipo);
    setContaOrigemId("");
    setContaDestinoId("");
    setOrigemTerceiro(null);
    setDestinoTerceiro(null);
  }

  return (
    <form action={formAction} className="max-w-md space-y-6">
      <input type="hidden" name="origemTerceiroId" value={origemTerceiro?.id ?? ""} />
      <input type="hidden" name="destinoTerceiroId" value={destinoTerceiro?.id ?? ""} />

      <div className="space-y-2">
        <Label htmlFor="tipoMovimento" className={labelClass}>Tipo de Transferência</Label>
        <Select name="tipoMovimento" value={tipoMovimento} items={TIPOS_MOVIMENTO} onValueChange={(v) => v && selecionarTipo(v as TipoMovimentoTransferencia)}>
          <SelectTrigger id="tipoMovimento" className={`w-full ${inputClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TIPOS_MOVIMENTO).map(([valor, rotulo]) => (
              <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!regra.semOrigem && (
        <div className="space-y-2">
          <Label htmlFor="contaOrigemId" className={labelClass}>Conta de Origem</Label>
          <Select
            name="contaOrigemId"
            value={contaOrigemId}
            items={itensOrigem}
            onValueChange={(v) => {
              setContaOrigemId(v ?? "");
              setOrigemTerceiro(null);
            }}
          >
            <SelectTrigger id="contaOrigemId" className={`w-full ${inputClass}`}>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {contasOrigem.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {contaOrigemSelecionada?.adiantamentoCliente && (
        <TerceiroPicker label="Cliente do adiantamento (origem)" terceiros={clientes} valor={origemTerceiro} onChange={setOrigemTerceiro} />
      )}
      {contaOrigemSelecionada?.adiantamentoFornecedor && (
        <TerceiroPicker label="Fornecedor do adiantamento (origem)" terceiros={fornecedores} valor={origemTerceiro} onChange={setOrigemTerceiro} />
      )}

      <div className="space-y-2">
        <Label htmlFor="contaDestinoId" className={labelClass}>Conta de Destino</Label>
        <Select
          name="contaDestinoId"
          value={contaDestinoId}
          items={itensDestino}
          onValueChange={(v) => {
            setContaDestinoId(v ?? "");
            setDestinoTerceiro(null);
          }}
        >
          <SelectTrigger id="contaDestinoId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {contasDestino.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {contaDestinoSelecionada?.adiantamentoCliente && (
        <TerceiroPicker label="Cliente do adiantamento (destino)" terceiros={clientes} valor={destinoTerceiro} onChange={setDestinoTerceiro} />
      )}
      {contaDestinoSelecionada?.adiantamentoFornecedor && (
        <TerceiroPicker label="Fornecedor do adiantamento (destino)" terceiros={fornecedores} valor={destinoTerceiro} onChange={setDestinoTerceiro} />
      )}

      {regra.afetaFluxoDeCaixa && (
        <p className="text-xs text-muted-foreground">
          Empréstimo contraído afeta o fluxo de caixa — usa o Plano Financeiro configurado em Parâmetros Financeiros.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="valor" className={labelClass}>Valor (R$)</Label>
          <Input id="valor" name="valor" type="number" step="0.01" min="0.01" required className={inputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data" className={labelClass}>Data</Label>
          <Input id="data" name="data" type="date" required defaultValue={hojeISO()} className={inputClass} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="historico" className={labelClass}>Histórico (opcional)</Label>
        <Input id="historico" name="historico" className={inputClass} />
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Transferir"}
        </Button>
        <Button type="button" variant="outline" render={<Link href={cancelarHref} />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
