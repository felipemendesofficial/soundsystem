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
import type { OrdemServicoFormState } from "@/app/(app)/ordens-servico/actions";
import { calcularAjusteTotal, type FormatoAjuste, type ModoAjuste } from "@/lib/ajuste-total";

type Item = { id: string; label: string };
type ServicoItem = Item & { precoPadrao: number };
type ClienteItem = Item & { tabelaPrecoPadraoId: string | null };
type VendedorItem = Item;

type Linha = {
  key: string;
  tipo: "produto" | "servico";
  item: Item | null;
  quantidade: string;
  precoUnitario: string;
};

type Action = (prevState: OrdemServicoFormState, formData: FormData) => Promise<OrdemServicoFormState>;

let contadorChave = 0;
function novaChave() {
  contadorChave += 1;
  return `linha-${contadorChave}`;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function OSForm({
  action,
  clientes,
  depositos,
  vendedores,
  produtos,
  servicos,
  tabelasPreco,
  precosPorTabela,
  ultimosPrecosVenda,
  depositoPadraoId,
  defaultValues,
}: {
  action: Action;
  clientes: ClienteItem[];
  depositos: Item[];
  vendedores: VendedorItem[];
  produtos: Item[];
  servicos: ServicoItem[];
  tabelasPreco: Item[];
  precosPorTabela: Record<string, Record<string, number>>;
  ultimosPrecosVenda: Record<string, number>;
  depositoPadraoId?: string | null;
  defaultValues?: {
    clienteId: string;
    depositoId: string;
    vendedorId: string;
    observacao: string | null;
    itens: {
      tipo: "produto" | "servico";
      itemId: string;
      label: string;
      quantidade: string;
      precoUnitario: string;
    }[];
  };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    (defaultValues?.itens ?? []).map((i) => ({
      key: novaChave(),
      tipo: i.tipo,
      item: { id: i.itemId, label: i.label },
      quantidade: i.quantidade,
      precoUnitario: i.precoUnitario,
    }))
  );
  // "" (nunca undefined) mesmo sem seleção — Select vira controlado assim que
  // recebe `value`; alternar de undefined pra string depois dispara warning
  // do React de componente trocando de não-controlado pra controlado.
  const [clienteId, setClienteId] = useState(defaultValues?.clienteId ?? "");
  const [vendedorId, setVendedorId] = useState(defaultValues?.vendedorId ?? "");
  const [tabelaPrecoId, setTabelaPrecoId] = useState(
    () => clientes.find((c) => c.id === defaultValues?.clienteId)?.tabelaPrecoPadraoId ?? ""
  );
  const [modoAjuste, setModoAjuste] = useState<ModoAjuste>("nenhum");
  const [formatoAjuste, setFormatoAjuste] = useState<FormatoAjuste>("percentual");
  const [valorAjuste, setValorAjuste] = useState("");

  const clientesItems = Object.fromEntries(clientes.map((c) => [c.id, c.label]));
  const vendedoresItems = Object.fromEntries(vendedores.map((v) => [v.id, v.label]));
  const depositosItems = Object.fromEntries(depositos.map((d) => [d.id, d.label]));
  const tabelasPrecoItems = Object.fromEntries(tabelasPreco.map((t) => [t.id, t.label]));

  // Mesma lógica de sugestão de preço do Lançamento: preço fixado na
  // tabela de preço ativa, senão o último preço de venda já praticado.
  function sugerirPreco(produtoId: string): string {
    const doTabela = tabelaPrecoId ? precosPorTabela[tabelaPrecoId]?.[produtoId] : undefined;
    if (doTabela !== undefined) return String(doTabela);
    const ultimo = ultimosPrecosVenda[produtoId];
    return ultimo !== undefined ? String(ultimo) : "";
  }

  function adicionarLinha(tipo: "produto" | "servico") {
    // Novo item entra no topo da lista, ao lado dos botões "+ Produto/Serviço"
    // — assim fica visível sem rolar a tela, útil ao lançar vários itens seguidos.
    setLinhas((atual) => [
      { key: novaChave(), tipo, item: null, quantidade: "1", precoUnitario: "0" },
      ...atual,
    ]);
  }

  function removerLinha(key: string) {
    setLinhas((atual) => atual.filter((l) => l.key !== key));
  }

  function atualizarLinha(key: string, patch: Partial<Linha>) {
    setLinhas((atual) => atual.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const linhasComItem = linhas.filter((l) => l.item !== null);

  // Desconto/acréscimo total da OS (produtos + serviços juntos), redistribuído
  // proporcionalmente entre os itens — mesma lógica do Lançamento. O
  // preço declarado em cada linha continua editável; "preço final" é quem
  // realmente vai no envio.
  const resultadoAjuste = calcularAjusteTotal(
    linhasComItem.map((l) => ({ quantidade: Number(l.quantidade) || 0, precoDeclarado: Number(l.precoUnitario) || 0 })),
    { modo: modoAjuste, formato: formatoAjuste, valor: Number(valorAjuste) || 0 }
  );

  const itensSerializados = JSON.stringify(
    linhasComItem.map((l, idx) => ({
      tipo: l.tipo,
      itemId: l.item!.id,
      quantidade: l.quantidade,
      precoUnitario: modoAjuste !== "nenhum" ? String(resultadoAjuste.precosFinais[idx]) : l.precoUnitario,
    }))
  );

  const precoFinalPorLinha = new Map(
    linhasComItem.map((l, idx) => [l.key, resultadoAjuste.precosFinais[idx]])
  );

  return (
    <form action={formAction} className="max-w-lg space-y-6">
      <input type="hidden" name="itens" value={itensSerializados} />

      <div className="space-y-2">
        <Label htmlFor="clienteId" className={labelClass}>Cliente</Label>
        <Select
          name="clienteId"
          value={clienteId}
          items={clientesItems}
          onValueChange={(valor) => {
            setClienteId(valor ?? "");
            const cliente = clientes.find((c) => c.id === valor);
            setTabelaPrecoId(cliente?.tabelaPrecoPadraoId ?? "");
          }}
        >
          <SelectTrigger id="clienteId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione o cliente" />
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

      {tabelasPreco.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="tabelaPrecoId" className={labelClass}>Tabela de Preço (sugestão)</Label>
          <Select
            value={tabelaPrecoId}
            items={tabelasPrecoItems}
            onValueChange={(valor) => setTabelaPrecoId(valor ?? "")}
          >
            <SelectTrigger id="tabelaPrecoId" className={`w-full ${inputClass}`}>
              <SelectValue placeholder="Nenhuma" />
            </SelectTrigger>
            <SelectContent>
              {tabelasPreco.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="vendedorId" className={labelClass}>Vendedor</Label>
        <Select
          name="vendedorId"
          value={vendedorId}
          items={vendedoresItems}
          onValueChange={(valor) => setVendedorId(valor ?? "")}
        >
          <SelectTrigger id="vendedorId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="Selecione o vendedor" />
          </SelectTrigger>
          <SelectContent>
            {vendedores.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="depositoId" className={labelClass}>Depósito</Label>
        <Select
          name="depositoId"
          defaultValue={defaultValues?.depositoId ?? depositoPadraoId ?? undefined}
          items={depositosItems}
        >
          <SelectTrigger id="depositoId" className={`w-full ${inputClass}`}>
            <SelectValue placeholder="De onde saem os produtos" />
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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className={labelClass}>Itens</Label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => adicionarLinha("servico")}>
              + Serviço
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => adicionarLinha("produto")}>
              + Produto
            </Button>
          </div>
        </div>

        {linhas.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nenhum item adicionado.
          </p>
        )}

        <ul className="space-y-3">
          {linhas.map((linha) => {
            const opcoes: Item[] = linha.tipo === "produto" ? produtos : servicos;
            return (
              <li key={linha.key} className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    {linha.tipo === "produto" ? "Produto" : "Serviço"}
                  </span>
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
                  items={opcoes}
                  value={linha.item}
                  onValueChange={(item: Item | null) => {
                    atualizarLinha(linha.key, {
                      item,
                      precoUnitario: !item
                        ? linha.precoUnitario
                        : linha.tipo === "servico"
                          ? String((item as ServicoItem).precoPadrao)
                          : sugerirPreco(item.id),
                    });
                  }}
                  itemToStringLabel={(item: Item) => item.label}
                  itemToStringValue={(item: Item) => item.id}
                >
                  <ComboboxInputGroup>
                    <ComboboxInput
                      placeholder={linha.tipo === "produto" ? "Buscar produto..." : "Buscar serviço..."}
                    />
                    <ComboboxIcon />
                  </ComboboxInputGroup>
                  <ComboboxContent>
                    <ComboboxEmpty>Nada encontrado.</ComboboxEmpty>
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
                  <div className="space-y-1">
                    <Label className="text-xs">Preço Unit. (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={linha.precoUnitario}
                      onChange={(e) => atualizarLinha(linha.key, { precoUnitario: e.target.value })}
                      className="h-10 bg-card"
                    />
                  </div>
                </div>

                {modoAjuste !== "nenhum" && linha.item && (
                  <p className="text-xs text-muted-foreground">
                    Preço final (com {modoAjuste === "desconto" ? "desconto" : "acréscimo"}):{" "}
                    <span className="font-semibold text-foreground">
                      {formatarMoeda(precoFinalPorLinha.get(linha.key) ?? 0)}
                    </span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        {linhasComItem.length > 0 && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <Label className={labelClass}>Desconto / Acréscimo (opcional)</Label>

            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={modoAjuste === "nenhum" ? "default" : "outline"}
                size="sm"
                onClick={() => setModoAjuste("nenhum")}
              >
                Nenhum
              </Button>
              <Button
                type="button"
                variant={modoAjuste === "desconto" ? "default" : "outline"}
                size="sm"
                onClick={() => setModoAjuste("desconto")}
              >
                Desconto
              </Button>
              <Button
                type="button"
                variant={modoAjuste === "acrescimo" ? "default" : "outline"}
                size="sm"
                onClick={() => setModoAjuste("acrescimo")}
              >
                Acréscimo
              </Button>
            </div>

            {modoAjuste !== "nenhum" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={formatoAjuste === "percentual" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormatoAjuste("percentual")}
                  >
                    Percentual (%)
                  </Button>
                  <Button
                    type="button"
                    variant={formatoAjuste === "valor" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormatoAjuste("valor")}
                  >
                    Valor (R$)
                  </Button>
                </div>

                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={formatoAjuste === "percentual" ? "Ex.: 10" : "Ex.: 50,00"}
                  value={valorAjuste}
                  onChange={(e) => setValorAjuste(e.target.value)}
                  className="h-10 bg-background"
                />
              </>
            )}

            <div className="space-y-1 border-t border-border pt-3 text-sm">
              {modoAjuste !== "nenhum" && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatarMoeda(resultadoAjuste.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {modoAjuste === "desconto" ? "Desconto" : "Acréscimo"}
                    </span>
                    <span className="font-medium">
                      {modoAjuste === "desconto" ? "−" : "+"}
                      {formatarMoeda(resultadoAjuste.valorAjuste)}
                    </span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Total</span>
                <span>{formatarMoeda(resultadoAjuste.total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacao" className={labelClass}>Observação</Label>
        <Input
          id="observacao"
          name="observacao"
          defaultValue={defaultValues?.observacao ?? ""}
          className={inputClass}
        />
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-7 text-base">
          {pending ? "Salvando..." : "Salvar Ordem de Serviço"}
        </Button>
        <Button
          type="button"
          variant="outline"
          render={<Link href="/ordens-servico" />}
          className="h-11 px-7 text-base"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
