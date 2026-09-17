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
type ProdutoItem = Item & { controlaEstoque: boolean };
type ServicoItem = Item & { precoPadrao: number };
type ClienteItem = Item & { tabelaPrecoPadraoId: string | null };
type VendedorItem = Item;

type Linha = {
  key: string;
  tipo: "produto" | "servico";
  item: Item | null;
  quantidade: string;
  // Preço-base digitado — nunca sobrescrito pelo desconto/acréscimo (ver
  // schema.prisma#ItemOrdemServicoProduto.precoOriginal). "Preço final" é só
  // uma prévia calculada, exibida por linha, nunca guardada aqui.
  precoOriginal: string;
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
  produtosComEstoquePorDeposito,
  depositoPadraoId,
  acoesExtras,
  defaultValues,
}: {
  action: Action;
  clientes: ClienteItem[];
  depositos: Item[];
  vendedores: VendedorItem[];
  produtos: ProdutoItem[];
  servicos: ServicoItem[];
  tabelasPreco: Item[];
  precosPorTabela: Record<string, Record<string, number>>;
  ultimosPrecosVenda: Record<string, number>;
  produtosComEstoquePorDeposito: Record<string, string[]>;
  depositoPadraoId?: string | null;
  acoesExtras?: React.ReactNode;
  defaultValues?: {
    clienteId: string;
    depositoId: string;
    vendedorId: string;
    observacao: string | null;
    modoAjuste: ModoAjuste;
    formatoAjuste: FormatoAjuste;
    valorAjuste: string;
    itens: {
      tipo: "produto" | "servico";
      itemId: string;
      label: string;
      quantidade: string;
      precoOriginal: string;
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
      precoOriginal: i.precoOriginal,
    }))
  );
  // "" (nunca undefined) mesmo sem seleção — Select vira controlado assim que
  // recebe `value`; alternar de undefined pra string depois dispara warning
  // do React de componente trocando de não-controlado pra controlado.
  const [clienteId, setClienteId] = useState(defaultValues?.clienteId ?? "");
  const [vendedorId, setVendedorId] = useState(defaultValues?.vendedorId ?? "");
  const [depositoId, setDepositoId] = useState(defaultValues?.depositoId ?? depositoPadraoId ?? "");
  const [tabelaPrecoId, setTabelaPrecoId] = useState(
    () => clientes.find((c) => c.id === defaultValues?.clienteId)?.tabelaPrecoPadraoId ?? ""
  );
  const [modoAjuste, setModoAjuste] = useState<ModoAjuste>(defaultValues?.modoAjuste ?? "nenhum");
  const [formatoAjuste, setFormatoAjuste] = useState<FormatoAjuste>(defaultValues?.formatoAjuste ?? "percentual");
  const [valorAjuste, setValorAjuste] = useState(
    defaultValues?.valorAjuste && Number(defaultValues.valorAjuste) > 0 ? defaultValues.valorAjuste : ""
  );

  const clientesItems = Object.fromEntries(clientes.map((c) => [c.id, c.label]));
  const vendedoresItems = Object.fromEntries(vendedores.map((v) => [v.id, v.label]));
  const depositosItems = Object.fromEntries(depositos.map((d) => [d.id, d.label]));
  const tabelasPrecoItems = Object.fromEntries(tabelasPreco.map((t) => [t.id, t.label]));

  // A OS sempre dá saída de estoque ao ser concluída — só oferece produtos
  // com saldo positivo no depósito escolhido; produtos com
  // controlaEstoque=false ficam sempre disponíveis (saldo não rastreado).
  const produtosParaEscolher: Item[] = produtos.filter(
    (p) => !p.controlaEstoque || (produtosComEstoquePorDeposito[depositoId] ?? []).includes(p.id)
  );

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
      { key: novaChave(), tipo, item: null, quantidade: "1", precoOriginal: "0" },
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
  // proporcionalmente entre os itens — mesma lógica do Lançamento. Isso aqui
  // é só uma prévia pro usuário ver o "preço final" por linha; quem decide de
  // verdade é o server, recalculando a partir de precoOriginal + do
  // modoAjuste/formatoAjuste/valorAjuste enviados — nunca confiamos no preço
  // final calculado no client.
  const resultadoAjuste = calcularAjusteTotal(
    linhasComItem.map((l) => ({ quantidade: Number(l.quantidade) || 0, precoDeclarado: Number(l.precoOriginal) || 0 })),
    { modo: modoAjuste, formato: formatoAjuste, valor: Number(valorAjuste) || 0 }
  );

  const itensSerializados = JSON.stringify(
    linhasComItem.map((l) => ({
      tipo: l.tipo,
      itemId: l.item!.id,
      quantidade: l.quantidade,
      precoOriginal: l.precoOriginal,
    }))
  );

  const precoFinalPorLinha = new Map(
    linhasComItem.map((l, idx) => [l.key, resultadoAjuste.precosFinais[idx]])
  );

  return (
    <>
    <form id="os-form" action={formAction} className="max-w-lg space-y-6">
      <input type="hidden" name="itens" value={itensSerializados} />
      <input type="hidden" name="modoAjuste" value={modoAjuste} />
      <input type="hidden" name="formatoAjuste" value={formatoAjuste} />
      <input type="hidden" name="valorAjuste" value={valorAjuste || "0"} />

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
          value={depositoId}
          items={depositosItems}
          onValueChange={(valor) => setDepositoId(valor ?? "")}
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
            const opcoes: Item[] = linha.tipo === "produto" ? produtosParaEscolher : servicos;
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
                      precoOriginal: !item
                        ? linha.precoOriginal
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
                      value={linha.precoOriginal}
                      onChange={(e) => atualizarLinha(linha.key, { precoOriginal: e.target.value })}
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
      <div className="h-16" />
    </form>
    <div className="fixed bottom-[57px] left-0 right-0 z-30 mx-auto flex w-full max-w-[400px] items-center gap-2 overflow-x-auto border-t border-border bg-card px-[18px] py-2.5 [scrollbar-width:none]">
      {acoesExtras}
      <Button type="submit" form="os-form" disabled={pending} size="sm" className="flex-none whitespace-nowrap">
        {pending ? "Salvando..." : "Salvar"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        render={<Link href="/ordens-servico" />}
        className="flex-none whitespace-nowrap"
      >
        Voltar
      </Button>
    </div>
    </>
  );
}
