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
import { RateioEditor, type ItemRateio, type LinhaRateioEditor, novaChaveRateio } from "@/components/rateio-editor";
import { cn } from "@/lib/utils";
import type { LancamentoFinanceiroFormState } from "./actions";

type Action = (prevState: LancamentoFinanceiroFormState, formData: FormData) => Promise<LancamentoFinanceiroFormState>;

type LinhaPlano = { key: string; conta: ItemRateio | null; percentual: string; centroCusto: LinhaRateioEditor[] };

function linhaPlanoVazia(): LinhaPlano {
  return { key: novaChaveRateio(), conta: null, percentual: "", centroCusto: [] };
}

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

const TIPOS_DOCUMENTO: Record<string, string> = {
  especie: "Espécie",
  cheque_vista: "Cheque à Vista",
  cheque_prazo: "Cheque a Prazo",
  cheque_devolvido: "Cheque Devolvido",
  deposito_cartorio: "Depósito em Cartório",
  nota_promissoria: "Nota Promissória",
  deposito_bancario: "Depósito Bancário",
  pix: "Pix",
  cartao: "Cartão",
};

const TIPOS_TAXA_CARTAO: Record<string, string> = {
  a_vista: "À Vista",
  antecipacao: "Antecipação",
  parc_estabelecimento: "Parcelado — Estabelecimento",
  parc_cliente: "Parcelado — Cliente",
};

export function LancamentoFinanceiroForm({
  action,
  clientes,
  fornecedores,
  portadores,
  contasFinanceiras,
  processos,
  processoPadraoId,
  planoFinanceiro,
  centroCusto,
  processoItens,
  vendedores,
}: {
  action: Action;
  clientes: ItemRateio[];
  fornecedores: ItemRateio[];
  portadores: ItemRateio[];
  contasFinanceiras: ItemRateio[];
  processos: ItemRateio[];
  processoPadraoId?: string | null;
  planoFinanceiro: { id: string; label: string; tipo: "receita" | "despesa" }[];
  centroCusto: ItemRateio[];
  processoItens: { id: string; label: string; processoId: string }[];
  vendedores: ItemRateio[];
}) {
  const [state, formAction, pending] = useActionState(action, {});

  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [tipoDocumento, setTipoDocumento] = useState<string>("especie");
  const [processoId, setProcessoId] = useState<string>(processoPadraoId ?? "");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [fornecedorId, setFornecedorId] = useState<string | null>(null);

  const [rateioPlano, setRateioPlano] = useState<LinhaPlano[]>([]);
  const [rateioProcesso, setRateioProcesso] = useState<LinhaRateioEditor[]>([]);
  const [retencoes, setRetencoes] = useState<LinhaRateioEditor[]>([]);
  const [comissoes, setComissoes] = useState<LinhaRateioEditor[]>([]);

  const itensClientes = Object.fromEntries(clientes.map((c) => [c.id, c.label]));
  const itensFornecedores = Object.fromEntries(fornecedores.map((f) => [f.id, f.label]));
  const itensPortadores = Object.fromEntries(portadores.map((p) => [p.id, p.label]));
  const itensContas = Object.fromEntries(contasFinanceiras.map((c) => [c.id, c.label]));
  const itensProcessos = Object.fromEntries(processos.map((p) => [p.id, p.label]));

  const planoFinanceiroFiltrado = useMemo(
    () => planoFinanceiro.filter((p) => p.tipo === tipo).map((p) => ({ id: p.id, label: p.label })),
    [planoFinanceiro, tipo]
  );
  const processoItensFiltrados = useMemo(
    () => processoItens.filter((i) => i.processoId === processoId).map((i) => ({ id: i.id, label: i.label })),
    [processoItens, processoId]
  );

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
        centroCusto: l.centroCusto
          .filter((cc) => cc.conta)
          .map((cc) => ({ centroCustoId: cc.conta!.id, percentual: cc.percentual })),
      }))
  );
  const rateioProcessoSerializado = JSON.stringify(
    rateioProcesso.filter((l) => l.conta).map((l) => ({ processoItemId: l.conta!.id, percentual: l.percentual }))
  );
  const retencoesSerializadas = JSON.stringify(
    retencoes.filter((l) => l.conta).map((l) => ({ planoId: l.conta!.id, percentual: l.percentual }))
  );
  const comissoesSerializadas = JSON.stringify(
    comissoes.filter((l) => l.conta).map((l) => ({ vendedorId: l.conta!.id, percentual: l.percentual }))
  );

  return (
    <>
      <form id="lancamento-financeiro-form" action={formAction} className="max-w-lg space-y-6">
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="tipoDocumento" value={tipoDocumento} />
        <input type="hidden" name="processoId" value={processoId} />
        <input type="hidden" name="clienteId" value={clienteId ?? ""} />
        <input type="hidden" name="fornecedorId" value={fornecedorId ?? ""} />
        <input type="hidden" name="rateioPlano" value={rateioPlanoSerializado} />
        <input type="hidden" name="rateioProcesso" value={rateioProcessoSerializado} />
        <input type="hidden" name="retencoes" value={retencoesSerializadas} />
        <input type="hidden" name="comissoes" value={comissoesSerializadas} />

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={tipo === "despesa" ? "default" : "outline"} onClick={() => setTipo("despesa")}>
            Despesa
          </Button>
          <Button type="button" variant={tipo === "receita" ? "default" : "outline"} onClick={() => setTipo("receita")}>
            Receita
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="historicoSimplificado" className={labelClass}>Histórico</Label>
          <Input id="historicoSimplificado" name="historicoSimplificado" required className={inputClass} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="historicoComplementar" className={labelClass}>Histórico Complementar (opcional)</Label>
          <Input id="historicoComplementar" name="historicoComplementar" className={inputClass} />
        </div>

        <div className="space-y-2">
          <Label className={labelClass}>{tipo === "despesa" ? "Fornecedor" : "Cliente"}</Label>
          <Combobox
            items={tipo === "despesa" ? fornecedores : clientes}
            value={
              tipo === "despesa"
                ? (fornecedores.find((f) => f.id === fornecedorId) ?? null)
                : (clientes.find((c) => c.id === clienteId) ?? null)
            }
            onValueChange={(item: ItemRateio | null) =>
              tipo === "despesa" ? setFornecedorId(item?.id ?? null) : setClienteId(item?.id ?? null)
            }
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
                {(item: ItemRateio) => (
                  <ComboboxItem key={item.id} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="valorOriginal" className={labelClass}>Valor (R$)</Label>
            <Input id="valorOriginal" name="valorOriginal" type="number" step="0.01" min="0.01" required className={inputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="moraMes" className={labelClass}>Mora ao Mês (%)</Label>
            <Input id="moraMes" name="moraMes" type="number" step="0.01" min="0" className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="dataEmissao" className={labelClass}>Emissão</Label>
            <Input id="dataEmissao" name="dataEmissao" type="date" required className={inputClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dataVencimento" className={labelClass}>Vencimento</Label>
            <Input id="dataVencimento" name="dataVencimento" type="date" required className={inputClass} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="processoIdSelect" className={labelClass}>Processo</Label>
          <Select value={processoId} items={itensProcessos} onValueChange={(v) => v && setProcessoId(v)}>
            <SelectTrigger id="processoIdSelect" className={`w-full ${inputClass}`}>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {processos.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="portadorId" className={labelClass}>Portador (opcional)</Label>
            <Select name="portadorId" items={itensPortadores}>
              <SelectTrigger id="portadorId" className={`w-full ${inputClass}`}>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                {portadores.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contaPrevistaId" className={labelClass}>Conta Prevista (opcional)</Label>
            <Select name="contaPrevistaId" items={itensContas}>
              <SelectTrigger id="contaPrevistaId" className={`w-full ${inputClass}`}>
                <SelectValue placeholder="Nenhuma" />
              </SelectTrigger>
              <SelectContent>
                {contasFinanceiras.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="documento" className={labelClass}>Documento (opcional)</Label>
          <Input id="documento" name="documento" className={inputClass} />
        </div>
        <div className="flex items-center gap-3">
          <Checkbox id="documentoFisico" name="documentoFisico" />
          <Label htmlFor="documentoFisico" className={labelClass}>Documento físico está com a empresa</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tipoDocumentoSelect" className={labelClass}>Tipo de Documento</Label>
          <Select value={tipoDocumento} items={TIPOS_DOCUMENTO} onValueChange={(v) => v && setTipoDocumento(v)}>
            <SelectTrigger id="tipoDocumentoSelect" className={`w-full ${inputClass}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIPOS_DOCUMENTO).map(([valor, rotulo]) => (
                <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {tipoDocumento.startsWith("cheque_") && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <Label className={labelClass}>Dados do Cheque</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input name="chequeBanco" placeholder="Banco" className="h-10 bg-background" />
              <Input name="chequeAgencia" placeholder="Agência" className="h-10 bg-background" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input name="chequeNumeroCheque" placeholder="Número do Cheque" className="h-10 bg-background" />
              <Input name="chequeContaCorrente" placeholder="Conta Corrente" className="h-10 bg-background" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input name="chequeCgc" placeholder="CGC" className="h-10 bg-background" />
              <Input name="chequeCpf" placeholder="CPF" className="h-10 bg-background" />
            </div>
            <Input name="chequeTelefone" placeholder="Telefone" className="h-10 bg-background" />
            <p className="text-xs text-muted-foreground">Se o cheque for de terceiro (não do {tipo === "despesa" ? "fornecedor" : "cliente"} acima), informe abaixo — só um dos dois.</p>
            <div className="space-y-1">
              <Label className="text-xs">Terceiro — Cliente</Label>
              <Select name="chequeTerceiroClienteId" items={itensClientes}>
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Terceiro — Fornecedor</Label>
              <Select name="chequeTerceiroFornecedorId" items={itensFornecedores}>
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {tipoDocumento === "cartao" && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <Label className={labelClass}>Dados do Cartão</Label>
            <Input name="cartaoOperadora" placeholder="Operadora" className="h-10 bg-background" />
            <div className="grid grid-cols-2 gap-3">
              <Input name="cartaoNumeroCartao" placeholder="Número do Cartão" className="h-10 bg-background" />
              <Input name="cartaoLoteRv" placeholder="Lote RV" className="h-10 bg-background" />
            </div>
            <Input name="cartaoNumeroAutorizacao" placeholder="Número de Autorização" className="h-10 bg-background" />
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Taxa</Label>
              <Select name="cartaoTipoTaxa" items={TIPOS_TAXA_CARTAO}>
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS_TAXA_CARTAO).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className={labelClass}>Rateio — Plano Financeiro</Label>
            <button type="button" onClick={adicionarLinhaPlano} className="text-sm font-medium text-primary">
              + Linha
            </button>
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
                          {(item: ItemRateio) => (
                            <ComboboxItem key={item.id} value={item}>
                              {item.label}
                            </ComboboxItem>
                          )}
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
        />

        <RateioEditor
          titulo="Retenções (opcional)"
          itens={planoFinanceiroFiltrado}
          linhas={retencoes}
          onChange={setRetencoes}
          exigirSoma100={false}
          placeholderBusca="Buscar tributo..."
        />

        <RateioEditor
          titulo="Comissões (opcional)"
          itens={vendedores}
          linhas={comissoes}
          onChange={setComissoes}
          exigirSoma100={false}
          placeholderBusca="Buscar vendedor..."
        />

        <div className="space-y-2">
          <Label htmlFor="observacao" className={labelClass}>Observação (opcional)</Label>
          <Input id="observacao" name="observacao" className={inputClass} />
        </div>

        {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
        <div className="h-16" />
      </form>
      <div className="fixed bottom-[57px] left-0 right-0 z-30 mx-auto flex w-full max-w-[400px] items-center gap-2 border-t border-border bg-card px-[18px] py-2.5">
        <Button type="submit" form="lancamento-financeiro-form" disabled={pending} size="sm" className="flex-none whitespace-nowrap">
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="outline" size="sm" render={<Link href="/lancamentos-financeiros" />} className="flex-none whitespace-nowrap">
          Cancelar
        </Button>
      </div>
    </>
  );
}
