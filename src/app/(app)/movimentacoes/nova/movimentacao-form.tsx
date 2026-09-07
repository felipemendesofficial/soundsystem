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
import { registrarMovimento, type MovimentacaoFormState } from "../actions";

const ENTRADA_TIPOS = new Set(["compra", "devolucao_cliente", "ajuste_entrada"]);
const SAIDA_TIPOS = new Set(["venda", "devolucao_fornecedor", "perda_avaria", "uso_interno", "ajuste_saida"]);

const TIPOS_LABEL: Record<string, string> = {
  compra: "Compra (entrada)",
  devolucao_cliente: "Devolução de cliente (entrada)",
  ajuste_entrada: "Ajuste de inventário (entrada)",
  venda: "Venda (saída)",
  devolucao_fornecedor: "Devolução a fornecedor (saída)",
  perda_avaria: "Perda / avaria (saída)",
  uso_interno: "Uso interno (saída)",
  ajuste_saida: "Ajuste de inventário (saída)",
  transferencia: "Transferência entre depósitos",
};

const TODOS_OS_TIPOS = [
  "compra",
  "devolucao_cliente",
  "ajuste_entrada",
  "venda",
  "devolucao_fornecedor",
  "perda_avaria",
  "uso_interno",
  "ajuste_saida",
  "transferencia",
];

const estadoInicial: MovimentacaoFormState = {};

type Item = { id: string; label: string };

type Linha = {
  key: string;
  produto: Item | null;
  quantidade: string;
  custoUnitario: string;
  precoVenda: string;
};

let contadorChave = 0;
function novaChave() {
  contadorChave += 1;
  return `linha-${contadorChave}`;
}

function linhaVazia(): Linha {
  return { key: novaChave(), produto: null, quantidade: "1", custoUnitario: "0", precoVenda: "" };
}

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function MovimentacaoForm({
  produtos,
  depositos,
  fornecedores,
  clientes,
  perfil,
  depositoPadraoId,
}: {
  produtos: Item[];
  depositos: Item[];
  fornecedores: Item[];
  clientes: Item[];
  perfil: string;
  depositoPadraoId: string | null;
}) {
  const tiposDisponiveis = perfil === "vendedor" ? ["venda"] : TODOS_OS_TIPOS;
  const [tipoMovimento, setTipoMovimento] = useState(tiposDisponiveis[0]);
  const [state, formAction, pending] = useActionState(registrarMovimento, estadoInicial);
  const [linhas, setLinhas] = useState<Linha[]>(() => [linhaVazia()]);

  const tiposItems = Object.fromEntries(tiposDisponiveis.map((tipo) => [tipo, TIPOS_LABEL[tipo]]));
  const depositosItems = Object.fromEntries(depositos.map((d) => [d.id, d.label]));
  const fornecedoresItems = Object.fromEntries(fornecedores.map((f) => [f.id, f.label]));
  const clientesItems = Object.fromEntries(clientes.map((c) => [c.id, c.label]));

  const ehEntrada = ENTRADA_TIPOS.has(tipoMovimento);
  const ehSaida = SAIDA_TIPOS.has(tipoMovimento);
  const ehVenda = tipoMovimento === "venda";
  const ehTransferencia = tipoMovimento === "transferencia";

  function adicionarLinha() {
    setLinhas((atual) => [...atual, linhaVazia()]);
  }

  function removerLinha(key: string) {
    setLinhas((atual) => (atual.length > 1 ? atual.filter((l) => l.key !== key) : atual));
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
        ...(ehEntrada ? { custoUnitario: l.custoUnitario } : {}),
        ...(ehVenda && l.precoVenda ? { precoVenda: l.precoVenda } : {}),
      }))
  );

  return (
    <form action={formAction} className="max-w-lg space-y-6">
      <input type="hidden" name="tipoMovimento" value={tipoMovimento} />
      <input type="hidden" name="itens" value={itensSerializados} />

      <div className="space-y-2">
        <Label htmlFor="tipoMovimentoSelect" className={labelClass}>Tipo de Movimento</Label>
        <Select
          value={tipoMovimento}
          items={tiposItems}
          onValueChange={(valor) => {
            if (valor) setTipoMovimento(valor);
          }}
        >
          <SelectTrigger id="tipoMovimentoSelect" className={`w-full ${inputClass}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tiposDisponiveis.map((tipo) => (
              <SelectItem key={tipo} value={tipo}>
                {TIPOS_LABEL[tipo]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ehTransferencia ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="depositoOrigemId" className={labelClass}>Depósito de Origem</Label>
            <Select name="depositoOrigemId" defaultValue={depositoPadraoId ?? undefined} items={depositosItems}>
              <SelectTrigger id="depositoOrigemId" className={`w-full ${inputClass}`}>
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
            <Label htmlFor="depositoDestinoId" className={labelClass}>Depósito de Destino</Label>
            <Select name="depositoDestinoId" items={depositosItems}>
              <SelectTrigger id="depositoDestinoId" className={`w-full ${inputClass}`}>
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
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="depositoId" className={labelClass}>Depósito</Label>
          <Select name="depositoId" defaultValue={depositoPadraoId ?? undefined} items={depositosItems}>
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
      )}

      {ehEntrada && (
        <div className="space-y-2">
          <Label htmlFor="fornecedorId" className={labelClass}>Fornecedor</Label>
          <Select name="fornecedorId" items={fornecedoresItems}>
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
      )}

      {ehSaida && ehVenda && (
        <div className="space-y-2">
          <Label htmlFor="clienteId" className={labelClass}>Cliente</Label>
          <Select name="clienteId" items={clientesItems}>
            <SelectTrigger id="clienteId" className={`w-full ${inputClass}`}>
              <SelectValue placeholder="Nenhum" />
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
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className={labelClass}>Produtos</Label>
          <Button type="button" variant="outline" size="sm" onClick={adicionarLinha}>
            + Produto
          </Button>
        </div>

        <ul className="space-y-3">
          {linhas.map((linha) => (
            <li key={linha.key} className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase text-muted-foreground">Produto</span>
                {linhas.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removerLinha(linha.key)}
                    aria-label="Remover item"
                  >
                    <Trash2 />
                  </Button>
                )}
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
                    className="h-10 bg-card"
                  />
                </div>
                {ehEntrada && (
                  <div className="space-y-1">
                    <Label className="text-xs">Custo Unit. (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={linha.custoUnitario}
                      onChange={(e) => atualizarLinha(linha.key, { custoUnitario: e.target.value })}
                      className="h-10 bg-card"
                    />
                  </div>
                )}
                {ehVenda && (
                  <div className="space-y-1">
                    <Label className="text-xs">Preço Venda (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={linha.precoVenda}
                      onChange={(e) => atualizarLinha(linha.key, { precoVenda: e.target.value })}
                      className="h-10 bg-card"
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacao" className={labelClass}>Observação</Label>
        <Input id="observacao" name="observacao" className={inputClass} />
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Registrando..." : "Registrar Movimento"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/" />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
