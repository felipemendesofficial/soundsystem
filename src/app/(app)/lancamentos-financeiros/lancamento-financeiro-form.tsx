"use client";

import { useActionState, useMemo, useState, type ChangeEvent } from "react";
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
import { CalculadoraButton } from "@/components/calculadora-button";
import { cn } from "@/lib/utils";
import { TIPOS_DOCUMENTO_LABEL, TIPOS_TAXA_CARTAO_LABEL } from "@/lib/financeiro-labels";
import { erroContaParaBaixa } from "@/lib/regras-conta-baixa";
import type { TipoDocumento, TipoConta } from "@/generated/prisma/client";
import type { LancamentoFinanceiroFormState } from "./actions";

type Action = (prevState: LancamentoFinanceiroFormState, formData: FormData) => Promise<LancamentoFinanceiroFormState>;

type LinhaPlano = { key: string; conta: ItemRateio | null; percentual: string; centroCusto: LinhaRateioEditor[] };

function linhaPlanoVazia(): LinhaPlano {
  return { key: novaChaveRateio(), conta: null, percentual: "100", centroCusto: [] };
}

function hojeISO() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

// Campos de texto simples do formulário. React reseta todo <input> não controlado
// assim que o <form action={...}> é submetido — mesmo quando a Server Action
// retorna um erro de validação, sem redirecionar (ver requestFormReset no
// react-dom). Por isso ficam num único objeto controlado: assim o valor digitado
// sobrevive à tentativa que falhou, em vez de ser apagado da tela.
type CamposTexto = {
  historicoSimplificado: string;
  historicoComplementar: string;
  documento: string;
  valorOriginal: string;
  moraMes: string;
  dataEmissao: string;
  dataVencimento: string;
  dataPrevisao: string;
  observacao: string;
  chequeBanco: string;
  chequeAgencia: string;
  chequeNumeroCheque: string;
  chequeContaCorrente: string;
  chequeCgc: string;
  chequeCpf: string;
  chequeTelefone: string;
  chequeTerceiro: string;
  cartaoNumeroCartao: string;
  cartaoNumeroAutorizacao: string;
};

const CAMPOS_CHEQUE = [
  "chequeBanco",
  "chequeAgencia",
  "chequeNumeroCheque",
  "chequeContaCorrente",
  "chequeCgc",
  "chequeCpf",
  "chequeTelefone",
  "chequeTerceiro",
] as const satisfies readonly (keyof CamposTexto)[];

const CAMPOS_CARTAO = [
  "cartaoNumeroCartao",
  "cartaoNumeroAutorizacao",
] as const satisfies readonly (keyof CamposTexto)[];

const camposTextoVazios: CamposTexto = {
  historicoSimplificado: "",
  historicoComplementar: "",
  documento: "",
  valorOriginal: "",
  moraMes: "",
  dataEmissao: "",
  dataVencimento: "",
  dataPrevisao: "",
  observacao: "",
  chequeBanco: "",
  chequeAgencia: "",
  chequeNumeroCheque: "",
  chequeContaCorrente: "",
  chequeCgc: "",
  chequeCpf: "",
  chequeTelefone: "",
  chequeTerceiro: "",
  cartaoNumeroCartao: "",
  cartaoNumeroAutorizacao: "",
};

/** Formato "achatado" (ids + percentuais como string) usado para pré-preencher o formulário na edição. */
export type LancamentoFinanceiroDefaultValues = {
  tipo: "receita" | "despesa";
  natureza: "real" | "prevista";
  historicoSimplificado: string;
  historicoComplementar: string;
  documento: string;
  documentoFisico: boolean;
  tipoDocumento: string;
  portadorId: string | null;
  contaPrevistaId: string | null;
  clienteId: string | null;
  fornecedorId: string | null;
  valorOriginal: string;
  moraMes: string;
  dataEmissao: string;
  dataVencimento: string;
  dataPrevisao: string;
  processoId: string;
  observacao: string;
  rateioPlano: { planoId: string; percentual: string; centroCusto: { centroCustoId: string; percentual: string }[] }[];
  rateioProcesso: { processoItemId: string; percentual: string }[];
  retencoes: { planoId: string; percentual: string }[];
  comissoes: { vendedorId: string; percentual: string }[];
  chequeBanco: string;
  chequeAgencia: string;
  chequeNumeroCheque: string;
  chequeContaCorrente: string;
  chequeCgc: string;
  chequeCpf: string;
  chequeTelefone: string;
  chequeTerceiro: string;
  cartaoOperadoraId: string | null;
  cartaoOperadoraCartaoTaxaId: string | null;
  cartaoBandeiraId: string | null;
  cartaoNumeroCartao: string;
  cartaoNumeroAutorizacao: string;
  cartaoTipoTaxa: string;
};

export function LancamentoFinanceiroForm({
  action,
  clientes,
  fornecedores,
  portadores,
  contasFinanceiras,
  processos,
  processoPadraoId,
  portadorPadraoId,
  planoFinanceiro,
  centroCusto,
  processoItens,
  vendedores,
  operadorasCartao,
  taxasCartao,
  bandeiras,
  defaultValues,
}: {
  action: Action;
  clientes: ItemRateio[];
  fornecedores: ItemRateio[];
  portadores: ItemRateio[];
  contasFinanceiras: (ItemRateio & { tipo: TipoConta; adiantamentoCliente: boolean; adiantamentoFornecedor: boolean })[];
  processos: ItemRateio[];
  processoPadraoId?: string | null;
  portadorPadraoId?: string | null;
  planoFinanceiro: { id: string; label: string; tipo: "receita" | "despesa"; permiteRetencao: boolean }[];
  centroCusto: ItemRateio[];
  processoItens: { id: string; label: string; processoId: string }[];
  vendedores: ItemRateio[];
  operadorasCartao: ItemRateio[];
  bandeiras: ItemRateio[];
  taxasCartao: {
    id: string;
    operadoraId: string;
    label: string;
    taxaAvista: string;
    taxaAntecipacao: string;
    taxaParcEstabelecimento: string;
    taxaParcCliente: string;
  }[];
  defaultValues?: LancamentoFinanceiroDefaultValues;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const editando = defaultValues !== undefined;

  const processoIdInicial = defaultValues?.processoId ?? processoPadraoId ?? "";

  const [parcelado, setParcelado] = useState(false);
  const [numeroParcelas, setNumeroParcelas] = useState("2");
  const [tipo, setTipo] = useState<"receita" | "despesa">(defaultValues?.tipo ?? "despesa");
  const [natureza, setNatureza] = useState<"real" | "prevista">(defaultValues?.natureza ?? "real");
  const [tipoDocumento, setTipoDocumento] = useState<string>(defaultValues?.tipoDocumento ?? "especie");
  const [processoId, setProcessoId] = useState<string>(processoIdInicial);
  const [clienteId, setClienteId] = useState<string | null>(defaultValues?.clienteId ?? null);
  const [fornecedorId, setFornecedorId] = useState<string | null>(defaultValues?.fornecedorId ?? null);
  const [portadorId, setPortadorId] = useState<string | null>(defaultValues?.portadorId ?? portadorPadraoId ?? null);
  const [contaPrevistaId, setContaPrevistaId] = useState<string | null>(defaultValues?.contaPrevistaId ?? null);
  const [documentoFisico, setDocumentoFisico] = useState(defaultValues?.documentoFisico ?? false);
  const [cartaoTipoTaxa, setCartaoTipoTaxa] = useState<string>(defaultValues?.cartaoTipoTaxa ?? "");
  const [cartaoOperadoraId, setCartaoOperadoraId] = useState<string | null>(defaultValues?.cartaoOperadoraId ?? null);
  const [cartaoOperadoraCartaoTaxaId, setCartaoOperadoraCartaoTaxaId] = useState<string | null>(
    defaultValues?.cartaoOperadoraCartaoTaxaId ?? null
  );
  const [cartaoBandeiraId, setCartaoBandeiraId] = useState<string | null>(defaultValues?.cartaoBandeiraId ?? null);

  function limparCamposCartao() {
    setCampos((c) => ({ ...c, ...Object.fromEntries(CAMPOS_CARTAO.map((campo) => [campo, ""])) }));
    setCartaoTipoTaxa("");
    setCartaoOperadoraId(null);
    setCartaoOperadoraCartaoTaxaId(null);
    setCartaoBandeiraId(null);
  }

  function selecionarTipoDocumento(novoTipo: string) {
    setTipoDocumento((atual) => {
      // Limpa os campos da seção que está sendo escondida — senão eles ficam
      // "presos" no estado (mesmo sem aparecer na tela) e continuam sendo
      // validados/enviados como se ainda fizessem sentido pro tipo novo.
      if (atual.startsWith("cheque_") && !novoTipo.startsWith("cheque_")) {
        setCampos((c) => ({ ...c, ...Object.fromEntries(CAMPOS_CHEQUE.map((campo) => [campo, ""])) }));
      }
      if (atual === "cartao" && novoTipo !== "cartao") {
        limparCamposCartao();
      }
      return novoTipo;
    });
  }

  const [campos, setCampos] = useState<CamposTexto>(() => ({
    historicoSimplificado: defaultValues?.historicoSimplificado ?? camposTextoVazios.historicoSimplificado,
    historicoComplementar: defaultValues?.historicoComplementar ?? camposTextoVazios.historicoComplementar,
    documento: defaultValues?.documento ?? camposTextoVazios.documento,
    valorOriginal: defaultValues?.valorOriginal ?? camposTextoVazios.valorOriginal,
    moraMes: defaultValues?.moraMes ?? camposTextoVazios.moraMes,
    dataEmissao: defaultValues?.dataEmissao ?? hojeISO(),
    dataVencimento: defaultValues?.dataVencimento ?? camposTextoVazios.dataVencimento,
    dataPrevisao: defaultValues?.dataPrevisao ?? camposTextoVazios.dataPrevisao,
    observacao: defaultValues?.observacao ?? camposTextoVazios.observacao,
    chequeBanco: defaultValues?.chequeBanco ?? camposTextoVazios.chequeBanco,
    chequeAgencia: defaultValues?.chequeAgencia ?? camposTextoVazios.chequeAgencia,
    chequeNumeroCheque: defaultValues?.chequeNumeroCheque ?? camposTextoVazios.chequeNumeroCheque,
    chequeContaCorrente: defaultValues?.chequeContaCorrente ?? camposTextoVazios.chequeContaCorrente,
    chequeCgc: defaultValues?.chequeCgc ?? camposTextoVazios.chequeCgc,
    chequeCpf: defaultValues?.chequeCpf ?? camposTextoVazios.chequeCpf,
    chequeTelefone: defaultValues?.chequeTelefone ?? camposTextoVazios.chequeTelefone,
    chequeTerceiro: defaultValues?.chequeTerceiro ?? camposTextoVazios.chequeTerceiro,
    cartaoNumeroCartao: defaultValues?.cartaoNumeroCartao ?? camposTextoVazios.cartaoNumeroCartao,
    cartaoNumeroAutorizacao: defaultValues?.cartaoNumeroAutorizacao ?? camposTextoVazios.cartaoNumeroAutorizacao,
  }));
  function campoTexto(nome: keyof CamposTexto) {
    return {
      value: campos[nome],
      onChange: (e: ChangeEvent<HTMLInputElement>) => setCampos((atual) => ({ ...atual, [nome]: e.target.value })),
    };
  }

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
  const [rateioProcesso, setRateioProcesso] = useState<LinhaRateioEditor[]>(() => {
    if (defaultValues) {
      return defaultValues.rateioProcesso.map((l) => ({
        key: novaChaveRateio(),
        conta: processoItens.find((i) => i.id === l.processoItemId) ?? null,
        percentual: l.percentual,
      }));
    }
    const itensDoProcesso = processoItens.filter((i) => i.processoId === processoIdInicial);
    return itensDoProcesso.length === 1
      ? [{ key: novaChaveRateio(), conta: itensDoProcesso[0], percentual: "100" }]
      : [];
  });
  const [retencoes, setRetencoes] = useState<LinhaRateioEditor[]>(() =>
    (defaultValues?.retencoes ?? []).map((l) => ({
      key: novaChaveRateio(),
      conta: planoFinanceiro.find((p) => p.id === l.planoId) ?? null,
      percentual: l.percentual,
    }))
  );
  const [comissoes, setComissoes] = useState<LinhaRateioEditor[]>(() =>
    (defaultValues?.comissoes ?? []).map((l) => ({
      key: novaChaveRateio(),
      conta: vendedores.find((v) => v.id === l.vendedorId) ?? null,
      percentual: l.percentual,
    }))
  );

  const itensPortadores = Object.fromEntries(portadores.map((p) => [p.id, p.label]));
  const itensProcessos = Object.fromEntries(processos.map((p) => [p.id, p.label]));

  // Mesma matriz de compatibilidade conta × documento × tipo usada na Baixa
  // (item 9 do pedido) — evita escolher aqui uma Conta Prevista que a Baixa
  // real nunca aceitaria depois.
  const contasFinanceirasFiltradas = useMemo(
    () =>
      contasFinanceiras.filter(
        (c) => !erroContaParaBaixa(c, { tipoLancamento: tipo, tipoDocumento: tipoDocumento as TipoDocumento })
      ),
    [contasFinanceiras, tipo, tipoDocumento]
  );
  const itensContas = Object.fromEntries(contasFinanceirasFiltradas.map((c) => [c.id, c.label]));

  const taxasCartaoFiltradas = useMemo(
    () => taxasCartao.filter((t) => t.operadoraId === cartaoOperadoraId),
    [taxasCartao, cartaoOperadoraId]
  );
  const taxaCartaoSelecionada = taxasCartaoFiltradas.find((t) => t.id === cartaoOperadoraCartaoTaxaId) ?? null;
  const percentualPorTipoTaxa: Record<string, string> = taxaCartaoSelecionada
    ? {
        a_vista: taxaCartaoSelecionada.taxaAvista,
        antecipacao: taxaCartaoSelecionada.taxaAntecipacao,
        parc_estabelecimento: taxaCartaoSelecionada.taxaParcEstabelecimento,
        parc_cliente: taxaCartaoSelecionada.taxaParcCliente,
      }
    : {};

  const planoFinanceiroFiltrado = useMemo(
    () => planoFinanceiro.filter((p) => p.tipo === tipo).map((p) => ({ id: p.id, label: p.label })),
    [planoFinanceiro, tipo]
  );
  const planoRetencaoFiltrado = useMemo(
    () => planoFinanceiro.filter((p) => p.tipo === tipo && p.permiteRetencao).map((p) => ({ id: p.id, label: p.label })),
    [planoFinanceiro, tipo]
  );
  const processoItensFiltrados = useMemo(
    () => processoItens.filter((i) => i.processoId === processoId).map((i) => ({ id: i.id, label: i.label })),
    [processoItens, processoId]
  );

  function selecionarProcesso(novoProcessoId: string) {
    setProcessoId(novoProcessoId);
    setRateioProcesso((atual) => {
      if (atual.length > 0) return atual;
      const itensDoProcesso = processoItens.filter((i) => i.processoId === novoProcessoId);
      return itensDoProcesso.length === 1
        ? [{ key: novaChaveRateio(), conta: itensDoProcesso[0], percentual: "100" }]
        : atual;
    });
  }

  function adicionarLinhaPlano() {
    setRateioPlano((atual) => [
      ...atual,
      {
        ...linhaPlanoVazia(),
        centroCusto:
          centroCusto.length === 1 ? [{ key: novaChaveRateio(), conta: centroCusto[0], percentual: "100" }] : [],
      },
    ]);
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
        <input type="hidden" name="natureza" value={natureza} />
        <input type="hidden" name="tipoDocumento" value={tipoDocumento} />
        <input type="hidden" name="processoId" value={processoId} />
        <input type="hidden" name="clienteId" value={clienteId ?? ""} />
        <input type="hidden" name="fornecedorId" value={fornecedorId ?? ""} />
        <input type="hidden" name="portadorId" value={portadorId ?? ""} />
        <input type="hidden" name="contaPrevistaId" value={contaPrevistaId ?? ""} />
        <input type="hidden" name="cartaoTipoTaxa" value={cartaoTipoTaxa} />
        <input type="hidden" name="cartaoOperadoraId" value={cartaoOperadoraId ?? ""} />
        <input type="hidden" name="cartaoOperadoraCartaoTaxaId" value={cartaoOperadoraCartaoTaxaId ?? ""} />
        <input type="hidden" name="cartaoBandeiraId" value={cartaoBandeiraId ?? ""} />
        <input type="hidden" name="rateioPlano" value={rateioPlanoSerializado} />
        <input type="hidden" name="rateioProcesso" value={rateioProcessoSerializado} />
        <input type="hidden" name="retencoes" value={retencoesSerializadas} />
        <input type="hidden" name="comissoes" value={comissoesSerializadas} />

        <div className="space-y-2">
          <Label htmlFor="tipoDocumentoSelect" className={labelClass}>Tipo de Documento</Label>
          <Select value={tipoDocumento} items={TIPOS_DOCUMENTO_LABEL} onValueChange={(v) => v && selecionarTipoDocumento(v)}>
            <SelectTrigger id="tipoDocumentoSelect" className={`w-full ${inputClass}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIPOS_DOCUMENTO_LABEL).map(([valor, rotulo]) => (
                <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Define quais contas ficam disponíveis para a Conta Prevista mais abaixo.</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={tipo === "despesa" ? "default" : "outline"}
            disabled={!!defaultValues}
            onClick={() => {
              setTipo("despesa");
              setClienteId(null);
              if (tipoDocumento === "cartao") limparCamposCartao();
            }}
          >
            Despesa
          </Button>
          <Button
            type="button"
            variant={tipo === "receita" ? "default" : "outline"}
            disabled={!!defaultValues}
            onClick={() => {
              setTipo("receita");
              setFornecedorId(null);
              if (tipoDocumento === "cartao") limparCamposCartao();
            }}
          >
            Receita
          </Button>
        </div>
        {defaultValues && (
          <p className="-mt-4 text-xs text-muted-foreground">
            Tipo não pode ser alterado depois de criado (o rateio do Plano Financeiro depende dele).
          </p>
        )}

        <div className="space-y-2">
          <Label className={labelClass}>Natureza</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={natureza === "real" ? "default" : "outline"} onClick={() => setNatureza("real")}>
              Real
            </Button>
            <Button type="button" variant={natureza === "prevista" ? "default" : "outline"} onClick={() => setNatureza("prevista")}>
              Previsão
            </Button>
          </div>
          {natureza === "prevista" && (
            <p className="text-xs text-muted-foreground">
              Uma previsão não pode receber Baixa até ser confirmada (vira Real) na tela do lançamento.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="historicoSimplificado" className={labelClass}>Histórico</Label>
          <Input id="historicoSimplificado" name="historicoSimplificado" required className={inputClass} {...campoTexto("historicoSimplificado")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="historicoComplementar" className={labelClass}>Histórico Complementar (opcional)</Label>
          <Input id="historicoComplementar" name="historicoComplementar" className={inputClass} {...campoTexto("historicoComplementar")} />
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
            <div className="flex items-center justify-between">
              <Label htmlFor="valorOriginal" className={labelClass}>{parcelado ? "Valor Total (R$)" : "Valor (R$)"}</Label>
              <CalculadoraButton valorAtual={campos.valorOriginal} onResultado={(valor) => setCampos((atual) => ({ ...atual, valorOriginal: valor }))} />
            </div>
            <Input id="valorOriginal" name="valorOriginal" type="number" step="0.01" min="0.01" required className={inputClass} {...campoTexto("valorOriginal")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="moraMes" className={labelClass}>Mora ao Mês (%)</Label>
            <Input id="moraMes" name="moraMes" type="number" step="0.01" min="0" className={inputClass} {...campoTexto("moraMes")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="dataEmissao" className={labelClass}>Emissão</Label>
            <Input id="dataEmissao" name="dataEmissao" type="date" required className={inputClass} {...campoTexto("dataEmissao")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dataVencimento" className={labelClass}>{parcelado ? "Vencimento (1ª parcela)" : "Vencimento"}</Label>
            <Input
              id="dataVencimento"
              name="dataVencimento"
              type="date"
              required
              min={campos.dataEmissao || undefined}
              className={inputClass}
              {...campoTexto("dataVencimento")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dataPrevisao" className={labelClass}>
            {parcelado ? "Data de Previsão (1ª parcela)" : "Data de Previsão (pagamento/recebimento real)"}
          </Label>
          <Input id="dataPrevisao" name="dataPrevisao" type="date" required className={inputClass} {...campoTexto("dataPrevisao")} />
          <p className="text-xs text-muted-foreground">
            Quando o título deve ser efetivamente pago/recebido na prática — pode ser diferente do vencimento.
          </p>
        </div>

        {!editando && (
          <div className="space-y-2 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Checkbox id="parcelado" name="parcelado" checked={parcelado} onCheckedChange={setParcelado} />
              <Label htmlFor="parcelado" className={labelClass}>Parcelado?</Label>
            </div>
            {parcelado && (
              <div className="space-y-2 pt-1">
                <Label htmlFor="numeroParcelas" className={labelClass}>Número de Parcelas</Label>
                <Input
                  id="numeroParcelas"
                  name="numeroParcelas"
                  type="number"
                  step="1"
                  min="2"
                  required
                  value={numeroParcelas}
                  onChange={(e) => setNumeroParcelas(e.target.value)}
                  className={inputClass}
                />
                <p className="text-xs text-muted-foreground">
                  O valor total é dividido em parcelas iguais (ajuste de centavos concentrado na última). Vencimento e
                  previsão de cada parcela avançam um mês a partir do que foi informado acima.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="processoIdSelect" className={labelClass}>Processo</Label>
          <Select value={processoId} items={itensProcessos} onValueChange={(v) => v && selecionarProcesso(v)}>
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
            <Select value={portadorId ?? ""} items={itensPortadores} onValueChange={(v) => setPortadorId(v || null)}>
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
            <Select value={contaPrevistaId ?? ""} items={itensContas} onValueChange={(v) => setContaPrevistaId(v || null)}>
              <SelectTrigger id="contaPrevistaId" className={`w-full ${inputClass}`}>
                <SelectValue placeholder="Nenhuma" />
              </SelectTrigger>
              <SelectContent>
                {contasFinanceirasFiltradas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="documento" className={labelClass}>Documento (opcional)</Label>
          <Input id="documento" name="documento" className={inputClass} {...campoTexto("documento")} />
        </div>
        <div className="flex items-center gap-3">
          <Checkbox id="documentoFisico" name="documentoFisico" checked={documentoFisico} onCheckedChange={setDocumentoFisico} />
          <Label htmlFor="documentoFisico" className={labelClass}>Documento físico está com a empresa</Label>
        </div>

        {tipoDocumento.startsWith("cheque_") && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <Label className={labelClass}>Dados do Cheque</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input name="chequeBanco" placeholder="Banco" className="h-10 bg-background" {...campoTexto("chequeBanco")} />
              <Input name="chequeAgencia" placeholder="Agência" className="h-10 bg-background" {...campoTexto("chequeAgencia")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input name="chequeNumeroCheque" placeholder="Número do Cheque" className="h-10 bg-background" {...campoTexto("chequeNumeroCheque")} />
              <Input name="chequeContaCorrente" placeholder="Conta Corrente" className="h-10 bg-background" {...campoTexto("chequeContaCorrente")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input name="chequeCgc" placeholder="CGC" className="h-10 bg-background" {...campoTexto("chequeCgc")} />
              <Input name="chequeCpf" placeholder="CPF" className="h-10 bg-background" {...campoTexto("chequeCpf")} />
            </div>
            <Input name="chequeTelefone" placeholder="Telefone" className="h-10 bg-background" {...campoTexto("chequeTelefone")} />
            <div className="space-y-1">
              <Label className="text-xs">Terceiro (opcional)</Label>
              <Input
                name="chequeTerceiro"
                placeholder={`Nome do terceiro, se não for o ${tipo === "despesa" ? "fornecedor" : "cliente"} acima`}
                className="h-10 bg-background"
                {...campoTexto("chequeTerceiro")}
              />
            </div>
          </div>
        )}

        {tipoDocumento === "cartao" && tipo === "receita" && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <Label className={labelClass}>Dados do Cartão</Label>
            <Combobox
              items={operadorasCartao}
              value={operadorasCartao.find((o) => o.id === cartaoOperadoraId) ?? null}
              onValueChange={(item: ItemRateio | null) => {
                setCartaoOperadoraId(item?.id ?? null);
                setCartaoOperadoraCartaoTaxaId(null);
              }}
              itemToStringLabel={(item: ItemRateio) => item.label}
              itemToStringValue={(item: ItemRateio) => item.id}
            >
              <ComboboxInputGroup>
                <ComboboxInput placeholder="Buscar operadora..." />
                <ComboboxIcon />
              </ComboboxInputGroup>
              <ComboboxContent>
                <ComboboxEmpty>Nenhuma operadora cadastrada.</ComboboxEmpty>
                <ComboboxList>
                  {(item: ItemRateio) => (
                    <ComboboxItem key={item.id} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>

            {cartaoOperadoraId && (
              <div className="space-y-1">
                <Label className="text-xs">Taxa (bandeira/modalidade)</Label>
                <Select
                  value={cartaoOperadoraCartaoTaxaId ?? ""}
                  items={Object.fromEntries(taxasCartaoFiltradas.map((t) => [t.id, t.label]))}
                  onValueChange={(v) => setCartaoOperadoraCartaoTaxaId(v || null)}
                >
                  <SelectTrigger className="h-10 w-full bg-background">
                    <SelectValue placeholder={taxasCartaoFiltradas.length === 0 ? "Nenhuma taxa cadastrada" : "Nenhuma"} />
                  </SelectTrigger>
                  <SelectContent>
                    {taxasCartaoFiltradas.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Input name="cartaoNumeroCartao" placeholder="Número do Cartão" className="h-10 bg-background" {...campoTexto("cartaoNumeroCartao")} />
            <Input name="cartaoNumeroAutorizacao" placeholder="Número de Autorização" className="h-10 bg-background" {...campoTexto("cartaoNumeroAutorizacao")} />
            <div className="space-y-1">
              <Label className="text-xs">Tipo de Taxa</Label>
              <Select value={cartaoTipoTaxa} items={TIPOS_TAXA_CARTAO_LABEL} onValueChange={(v) => setCartaoTipoTaxa(v ?? "")}>
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS_TAXA_CARTAO_LABEL).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cartaoTipoTaxa && percentualPorTipoTaxa[cartaoTipoTaxa] !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Percentual aplicado: {Number(percentualPorTipoTaxa[cartaoTipoTaxa]).toLocaleString("pt-BR")}%
                </p>
              )}
            </div>
          </div>
        )}

        {tipoDocumento === "cartao" && tipo === "despesa" && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <Label className={labelClass}>Dados do Cartão</Label>
            <p className="text-xs text-muted-foreground">
              Cartão próprio da empresa (ex.: cartão de crédito) — sem adquirente envolvido, só a bandeira e o número do cartão importam.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Bandeira</Label>
              <Select value={cartaoBandeiraId ?? ""} items={Object.fromEntries(bandeiras.map((b) => [b.id, b.label]))} onValueChange={(v) => setCartaoBandeiraId(v || null)}>
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {bandeiras.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input name="cartaoNumeroCartao" placeholder="Número do Cartão" className="h-10 bg-background" {...campoTexto("cartaoNumeroCartao")} />
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

        <RateioEditor
          titulo="Retenções (opcional)"
          itens={planoRetencaoFiltrado}
          linhas={retencoes}
          onChange={setRetencoes}
          exigirSoma100={false}
          placeholderBusca="Buscar tributo..."
          vazio="Nenhuma conta marcada como Retenção neste plano financeiro."
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
          <Input id="observacao" name="observacao" className={inputClass} {...campoTexto("observacao")} />
        </div>

        {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
        <div className="h-16" />
      </form>
      <div className="fixed bottom-[57px] left-0 right-0 z-30 mx-auto flex w-full max-w-[400px] items-center gap-2 border-t border-border bg-card px-[18px] py-2.5">
        <Button type="submit" form="lancamento-financeiro-form" disabled={pending} size="sm" className="flex-none whitespace-nowrap">
          {pending ? "Salvando..." : defaultValues ? "Salvar alterações" : "Salvar"}
        </Button>
        <Button type="button" variant="outline" size="sm" render={<Link href="/lancamentos-financeiros" />} className="flex-none whitespace-nowrap">
          Cancelar
        </Button>
      </div>
    </>
  );
}
