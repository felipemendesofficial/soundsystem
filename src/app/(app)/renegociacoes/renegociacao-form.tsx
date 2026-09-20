"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIPOS_DOCUMENTO_LABEL } from "@/lib/financeiro-labels";
import { cn } from "@/lib/utils";
import type { RenegociacaoFormState } from "./actions";

type Action = (prevState: RenegociacaoFormState, formData: FormData) => Promise<RenegociacaoFormState>;

type OrigemDisponivel = {
  id: string;
  tipo: "receita" | "despesa";
  label: string;
  valor: number;
  vencimento: string;
  grupoChave: string;
  contraparteId: string;
  contraparteLabel: string;
};
type Contraparte = { id: string; label: string; grupoChave: string };
type CreditoDisponivel = { id: string; label: string; saldoDisponivel: number; grupoChave: string; isCliente: boolean };

type LinhaDestino = {
  key: string;
  descricao: string;
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

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";
const fieldLabelClass = "text-xs font-semibold text-muted-foreground";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function RenegociacaoForm({
  action,
  origensDisponiveis,
  clientes,
  fornecedores,
  creditosDisponiveis,
  processos,
  processoPadraoId,
  processoItens,
}: {
  action: Action;
  origensDisponiveis: OrigemDisponivel[];
  clientes: Contraparte[];
  fornecedores: Contraparte[];
  creditosDisponiveis: CreditoDisponivel[];
  processos: Contraparte[];
  processoPadraoId?: string;
  processoItens: { id: string; label: string; processoId: string }[];
}) {
  function criarLinhaDestino(): LinhaDestino {
    contador += 1;
    const hoje = new Date().toISOString().slice(0, 10);
    const itensDoProcessoPadrao = processoPadraoId ? processoItens.filter((i) => i.processoId === processoPadraoId) : [];
    return {
      key: `destino-${contador}`,
      descricao: "",
      tipoDocumento: "especie",
      processoId: processoPadraoId ?? "",
      processoItemId: itensDoProcessoPadrao.length === 1 ? itensDoProcessoPadrao[0].id : "",
      dataEmissao: hoje,
      dataVencimento: hoje,
      valorOriginal: "",
      juros: "0",
      multa: "0",
      desconto: "0",
      justificativaDesconto: "",
    };
  }

  const [state, formAction, pending] = useActionState(action, {});

  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [motivo, setMotivo] = useState("");
  const [origensSelecionadas, setOrigensSelecionadas] = useState<Set<string>>(new Set());
  const [destinos, setDestinos] = useState<LinhaDestino[]>(() => [criarLinhaDestino()]);
  const [creditosSelecionados, setCreditosSelecionados] = useState<Record<string, string>>({});
  // Só usado quando os títulos de origem selecionados apontam pra mais de um
  // fornecedor/cliente do mesmo radical de CNPJ — aí sim pergunta qual usar.
  const [escolhaManual, setEscolhaManual] = useState<string | null>(null);

  function limparTudo() {
    setOrigensSelecionadas(new Set());
    setDestinos([criarLinhaDestino()]);
    setCreditosSelecionados({});
    setEscolhaManual(null);
  }

  const origensDoTipo = origensDisponiveis.filter((o) => o.tipo === tipo);
  const contrapartesDoTipo = tipo === "despesa" ? fornecedores : clientes;
  const creditosDoTipo = creditosDisponiveis.filter((c) => (tipo === "despesa" ? !c.isCliente : c.isCliente));

  // Fornecedor/cliente é derivado automaticamente dos títulos de origem
  // escolhidos — nunca digitado à mão pro destino. Com um só título/grupo, já
  // resolve sozinho; com mais de um fornecedor/cliente do mesmo radical de
  // CNPJ entre as origens, pergunta qual usar (e trava depois de respondido).
  const contrapartesDasOrigensSelecionadas: { id: string; label: string }[] = [];
  {
    const vistos = new Set<string>();
    for (const o of origensDoTipo) {
      if (origensSelecionadas.has(o.id) && o.contraparteId && !vistos.has(o.contraparteId)) {
        vistos.add(o.contraparteId);
        contrapartesDasOrigensSelecionadas.push({ id: o.contraparteId, label: o.contraparteLabel });
      }
    }
  }
  const contraparteEscolhidaId =
    contrapartesDasOrigensSelecionadas.length === 1
      ? contrapartesDasOrigensSelecionadas[0].id
      : contrapartesDasOrigensSelecionadas.length > 1 && contrapartesDasOrigensSelecionadas.some((c) => c.id === escolhaManual)
        ? escolhaManual
        : null;
  const contraparteResolvida = contrapartesDoTipo.find((c) => c.id === contraparteEscolhidaId) ?? null;

  // Mesmo fornecedor/cliente, ou mesma "chave de agrupamento" (radical de
  // CNPJ) em todo mundo envolvido — origens, contraparte resolvida e créditos
  // usados. Enquanto só uma chave estiver em jogo, trava as listas nela; sem
  // nada selecionado ainda, mostra tudo.
  const chavesEmUso = new Set<string>();
  for (const o of origensDoTipo) if (origensSelecionadas.has(o.id)) chavesEmUso.add(o.grupoChave);
  if (contraparteResolvida) chavesEmUso.add(contraparteResolvida.grupoChave);
  for (const creditoId of Object.keys(creditosSelecionados)) {
    const credito = creditosDoTipo.find((c) => c.id === creditoId);
    if (credito && Number(creditosSelecionados[creditoId]) > 0) chavesEmUso.add(credito.grupoChave);
  }
  const grupoAtivo = chavesEmUso.size === 1 ? [...chavesEmUso][0] : null;

  const origensExibidas = grupoAtivo ? origensDoTipo.filter((o) => o.grupoChave === grupoAtivo || origensSelecionadas.has(o.id)) : origensDoTipo;
  const creditosExibidos = grupoAtivo ? creditosDoTipo.filter((c) => c.grupoChave === grupoAtivo) : creditosDoTipo;

  const totalOrigens = origensDoTipo.filter((o) => origensSelecionadas.has(o.id)).reduce((acc, o) => acc + o.valor, 0);

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

  function alternarCredito(id: string, saldoMaximo: number) {
    setCreditosSelecionados((atual) => {
      const novo = { ...atual };
      if (id in novo) delete novo[id];
      else novo[id] = saldoMaximo.toFixed(2);
      return novo;
    });
  }
  function atualizarValorCredito(id: string, valor: string) {
    setCreditosSelecionados((atual) => ({ ...atual, [id]: valor }));
  }

  const totalDestinos = destinos.reduce((acc, d) => acc + (Number(d.valorOriginal) || 0), 0);
  const totalAjustes = destinos.reduce((acc, d) => acc + (Number(d.juros) || 0) + (Number(d.multa) || 0) - (Number(d.desconto) || 0), 0);
  const totalCreditoUsado = Object.values(creditosSelecionados).reduce((acc, v) => acc + (Number(v) || 0), 0);
  const totalEsperado = totalOrigens + totalAjustes - totalCreditoUsado;
  const fecha = Math.abs(totalDestinos - totalEsperado) < 0.01 && totalOrigens > 0 && contraparteEscolhidaId !== null;

  const destinosSerializados = JSON.stringify(
    destinos.map((d) => ({
      descricao: d.descricao,
      clienteId: tipo === "receita" ? contraparteEscolhidaId : undefined,
      fornecedorId: tipo === "despesa" ? contraparteEscolhidaId : undefined,
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
  );

  const creditosUsadosSerializados = JSON.stringify(
    Object.entries(creditosSelecionados)
      .filter(([, valor]) => Number(valor) > 0)
      .map(([creditoDevolucaoId, valor]) => ({ creditoDevolucaoId, valor }))
  );

  return (
    <form action={formAction} className="max-w-lg space-y-6">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="destinos" value={destinosSerializados} />
      <input type="hidden" name="creditosUsados" value={creditosUsadosSerializados} />
      {Array.from(origensSelecionadas).map((id) => (
        <input key={id} type="hidden" name="origensIds" value={id} />
      ))}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={tipo === "despesa" ? "default" : "outline"} onClick={() => { setTipo("despesa"); limparTudo(); }}>
          Despesa
        </Button>
        <Button type="button" variant={tipo === "receita" ? "default" : "outline"} onClick={() => { setTipo("receita"); limparTudo(); }}>
          Receita
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="motivo" className={labelClass}>Motivo</Label>
        <Input id="motivo" name="motivo" required value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputClass} />
      </div>

      <div className="space-y-2">
        <Label className={labelClass}>Títulos de Origem ({tipo === "despesa" ? "despesas" : "receitas"} em aberto)</Label>
        {grupoAtivo && (
          <p className="text-xs text-muted-foreground">
            Só títulos do mesmo fornecedor/cliente (ou filial com o mesmo radical de CNPJ) já envolvido nesta renegociação.
          </p>
        )}
        {origensExibidas.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nenhum título em aberto desse tipo/grupo.
          </p>
        ) : (
          <ul className="space-y-2">
            {origensExibidas.map((o) => (
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

      <div className="space-y-2">
        <Label className={labelClass}>{tipo === "despesa" ? "Fornecedor" : "Cliente"} (dos títulos de destino)</Label>
        {contrapartesDasOrigensSelecionadas.length === 0 && (
          <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            Selecione ao menos um título de origem pra definir {tipo === "despesa" ? "o fornecedor" : "o cliente"}.
          </p>
        )}
        {contrapartesDasOrigensSelecionadas.length > 1 && (
          <>
            <p className="text-xs text-muted-foreground">
              Os títulos selecionados envolvem mais de um {tipo === "despesa" ? "fornecedor" : "cliente"} do mesmo radical de CNPJ — qual usar nos títulos de destino?
            </p>
            <Select
              value={escolhaManual ?? ""}
              items={Object.fromEntries(contrapartesDasOrigensSelecionadas.map((c) => [c.id, c.label]))}
              onValueChange={(v) => setEscolhaManual(v || null)}
            >
              <SelectTrigger className={`w-full ${inputClass}`}>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {contrapartesDasOrigensSelecionadas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        {contraparteResolvida && (
          <p className="rounded-md border border-border bg-muted px-3.5 py-2.5 text-base">{contraparteResolvida.label}</p>
        )}
      </div>

      {creditosDoTipo.length > 0 && (
        <div className="space-y-2">
          <Label className={labelClass}>Créditos de Devolução (abatem o valor dos novos títulos)</Label>
          {creditosExibidos.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              Nenhum crédito disponível para esse grupo.
            </p>
          ) : (
            <ul className="space-y-2">
              {creditosExibidos.map((c) => {
                const marcado = c.id in creditosSelecionados;
                return (
                  <li key={c.id} className="space-y-2 rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <Checkbox checked={marcado} onCheckedChange={() => alternarCredito(c.id, c.saldoDisponivel)} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{c.label}</div>
                        <div className="text-xs text-muted-foreground">Saldo disponível: {formatarMoeda(c.saldoDisponivel)}</div>
                      </div>
                    </div>
                    {marcado && (
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={c.saldoDisponivel}
                        value={creditosSelecionados[c.id]}
                        onChange={(e) => atualizarValorCredito(c.id, e.target.value)}
                        className="h-10 bg-background"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {totalCreditoUsado > 0 && <p className="text-sm font-medium">Total de crédito usado: {formatarMoeda(totalCreditoUsado)}</p>}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className={labelClass}>Títulos de Destino</Label>
          <button type="button" onClick={() => setDestinos((atual) => [...atual, criarLinhaDestino()])} className="text-sm font-medium text-primary">
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

                <div className="space-y-1">
                  <Label htmlFor={`${destino.key}-descricao`} className={fieldLabelClass}>Histórico</Label>
                  <Input
                    id={`${destino.key}-descricao`}
                    placeholder="Histórico"
                    value={destino.descricao}
                    onChange={(e) => atualizarDestino(destino.key, { descricao: e.target.value })}
                    className="h-10 bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label className={fieldLabelClass}>Tipo de Documento</Label>
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
                </div>

                <div className="space-y-1">
                  <Label className={fieldLabelClass}>Processo</Label>
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
                </div>

                {destino.processoId && (
                  <div className="space-y-1">
                    <Label className={fieldLabelClass}>Item do Processo</Label>
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
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className={fieldLabelClass}>Data de Emissão</Label>
                    <Input type="date" value={destino.dataEmissao} onChange={(e) => atualizarDestino(destino.key, { dataEmissao: e.target.value })} className="h-10 bg-background" />
                  </div>
                  <div className="space-y-1">
                    <Label className={fieldLabelClass}>Data de Vencimento</Label>
                    <Input type="date" value={destino.dataVencimento} min={destino.dataEmissao} onChange={(e) => atualizarDestino(destino.key, { dataVencimento: e.target.value })} className="h-10 bg-background" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className={fieldLabelClass}>Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Valor (R$)"
                    value={destino.valorOriginal}
                    onChange={(e) => atualizarDestino(destino.key, { valorOriginal: e.target.value })}
                    className="h-10 bg-background"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className={fieldLabelClass}>Juros</Label>
                    <Input type="number" step="0.01" min="0" value={destino.juros} onChange={(e) => atualizarDestino(destino.key, { juros: e.target.value })} className="h-10 bg-background" />
                  </div>
                  <div className="space-y-1">
                    <Label className={fieldLabelClass}>Multa</Label>
                    <Input type="number" step="0.01" min="0" value={destino.multa} onChange={(e) => atualizarDestino(destino.key, { multa: e.target.value })} className="h-10 bg-background" />
                  </div>
                  <div className="space-y-1">
                    <Label className={fieldLabelClass}>Desconto</Label>
                    <Input type="number" step="0.01" min="0" value={destino.desconto} onChange={(e) => atualizarDestino(destino.key, { desconto: e.target.value })} className="h-10 bg-background" />
                  </div>
                </div>

                {Number(destino.desconto) > 0 && (
                  <div className="space-y-1">
                    <Label className={fieldLabelClass}>Justificativa do Desconto</Label>
                    <Input
                      placeholder="Justificativa do desconto"
                      value={destino.justificativaDesconto}
                      onChange={(e) => atualizarDestino(destino.key, { justificativaDesconto: e.target.value })}
                      className="h-10 bg-background"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Total das origens</span><span>{formatarMoeda(totalOrigens)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Juros + multa − desconto</span><span>{formatarMoeda(totalAjustes)}</span></div>
        {totalCreditoUsado > 0 && (
          <div className="flex justify-between"><span className="text-muted-foreground">Crédito de devolução usado</span><span>− {formatarMoeda(totalCreditoUsado)}</span></div>
        )}
        <div className="flex justify-between font-medium"><span>Esperado nos destinos</span><span>{formatarMoeda(totalEsperado)}</span></div>
        <div className={cn("flex justify-between font-medium", fecha ? "text-primary" : "text-destructive")}>
          <span>Soma dos destinos</span><span>{formatarMoeda(totalDestinos)}</span>
        </div>
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending || !fecha} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Salvar Rascunho"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/renegociacoes" />} className="h-11 px-7 text-base">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
