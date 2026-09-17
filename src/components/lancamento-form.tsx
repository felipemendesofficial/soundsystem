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
import type { LancamentoFormState } from "@/app/(app)/lancamentos/actions";
import { calcularAjusteTotal, type FormatoAjuste, type ModoAjuste } from "@/lib/ajuste-total";

type Action = (prevState: LancamentoFormState, formData: FormData) => Promise<LancamentoFormState>;

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

type Item = { id: string; label: string };
type ProdutoItem = Item & { controlaEstoque: boolean };
type ClienteItem = Item & { tabelaPrecoPadraoId: string | null };
type VendedorItem = Item;

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

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const labelClass = "text-[15px] font-semibold";
const inputClass = "h-11 px-3.5 text-base bg-card";

export function LancamentoForm({
  action,
  produtos,
  depositos,
  fornecedores,
  clientes,
  vendedores,
  tabelasPreco,
  precosPorTabela,
  ultimosPrecosVenda,
  produtosComEstoquePorDeposito,
  perfil,
  depositoPadraoId,
  acoesExtras,
  defaultValues,
}: {
  action: Action;
  produtos: ProdutoItem[];
  depositos: Item[];
  fornecedores: Item[];
  clientes: ClienteItem[];
  vendedores: VendedorItem[];
  tabelasPreco: Item[];
  precosPorTabela: Record<string, Record<string, number>>;
  ultimosPrecosVenda: Record<string, number>;
  produtosComEstoquePorDeposito: Record<string, string[]>;
  perfil: string;
  depositoPadraoId?: string | null;
  acoesExtras?: React.ReactNode;
  defaultValues?: {
    tipo: string;
    depositoId: string | null;
    depositoOrigemId: string | null;
    depositoDestinoId: string | null;
    fornecedorId: string | null;
    clienteId: string | null;
    vendedorId: string | null;
    observacao: string | null;
    modoAjuste: ModoAjuste;
    formatoAjuste: FormatoAjuste;
    valorAjuste: string;
    itens: { produtoId: string; label: string; quantidade: string; custoUnitario: string; precoVenda: string }[];
  };
}) {
  const editando = defaultValues !== undefined;
  const tiposDisponiveis = perfil === "vendedor" ? ["venda"] : TODOS_OS_TIPOS;
  const [tipoMovimento, setTipoMovimento] = useState(defaultValues?.tipo ?? tiposDisponiveis[0]);
  const [state, formAction, pending] = useActionState(action, {});
  const [linhas, setLinhas] = useState<Linha[]>(
    () =>
      // O input "Preço Venda" sempre segura o preço-base original digitado —
      // defaultValues.itens[].precoVenda aqui já vem como precoOriginal do
      // banco (ver page.tsx), nunca o preço líquido já descontado.
      defaultValues?.itens.map((i) => ({
        key: novaChave(),
        produto: { id: i.produtoId, label: i.label },
        quantidade: i.quantidade,
        custoUnitario: i.custoUnitario,
        precoVenda: i.precoVenda,
      })) ?? [linhaVazia()]
  );
  // "" (nunca undefined) mesmo sem seleção — Select vira controlado assim que
  // recebe `value`; alternar de undefined pra string depois dispara warning
  // do React de componente trocando de não-controlado pra controlado.
  const [clienteId, setClienteId] = useState(defaultValues?.clienteId ?? "");
  const [vendedorId, setVendedorId] = useState(defaultValues?.vendedorId ?? "");
  const [depositoId, setDepositoId] = useState(defaultValues?.depositoId ?? depositoPadraoId ?? "");
  const [depositoOrigemId, setDepositoOrigemId] = useState(
    defaultValues?.depositoOrigemId ?? depositoPadraoId ?? ""
  );
  const [tabelaPrecoId, setTabelaPrecoId] = useState("");
  const [modoAjuste, setModoAjuste] = useState<ModoAjuste>(defaultValues?.modoAjuste ?? "nenhum");
  const [formatoAjuste, setFormatoAjuste] = useState<FormatoAjuste>(defaultValues?.formatoAjuste ?? "percentual");
  const [valorAjuste, setValorAjuste] = useState(
    defaultValues?.valorAjuste && Number(defaultValues.valorAjuste) > 0 ? defaultValues.valorAjuste : ""
  );

  const tiposItems = Object.fromEntries(tiposDisponiveis.map((tipo) => [tipo, TIPOS_LABEL[tipo]]));
  const depositosItems = Object.fromEntries(depositos.map((d) => [d.id, d.label]));
  const fornecedoresItems = Object.fromEntries(fornecedores.map((f) => [f.id, f.label]));
  const clientesItems = Object.fromEntries(clientes.map((c) => [c.id, c.label]));
  const vendedoresItems = Object.fromEntries(vendedores.map((v) => [v.id, v.label]));
  const tabelasPrecoItems = Object.fromEntries(tabelasPreco.map((t) => [t.id, t.label]));

  const ehEntrada = ENTRADA_TIPOS.has(tipoMovimento);
  const ehSaida = SAIDA_TIPOS.has(tipoMovimento);
  const ehVenda = tipoMovimento === "venda";
  const ehTransferencia = tipoMovimento === "transferencia";

  // Nos tipos que dão saída de estoque (inclusive a origem de uma
  // transferência), só oferece produtos com saldo positivo no depósito
  // escolhido — produtos com controlaEstoque=false ficam sempre disponíveis,
  // já que o saldo deles não é rastreado.
  const depositoRelevanteParaSaida = ehTransferencia ? depositoOrigemId : depositoId;
  const produtosParaEscolher: Item[] =
    ehSaida || ehTransferencia
      ? produtos.filter(
          (p) => !p.controlaEstoque || (produtosComEstoquePorDeposito[depositoRelevanteParaSaida] ?? []).includes(p.id)
        )
      : produtos;

  // Sugestão de preço ao escolher um produto numa venda: preço fixado na
  // tabela de preço ativa, senão o último preço de venda já praticado para
  // esse produto — sempre editável, nunca imposto.
  function sugerirPreco(produtoId: string): string {
    const doTabela = tabelaPrecoId ? precosPorTabela[tabelaPrecoId]?.[produtoId] : undefined;
    if (doTabela !== undefined) return String(doTabela);
    const ultimo = ultimosPrecosVenda[produtoId];
    return ultimo !== undefined ? String(ultimo) : "";
  }

  function adicionarLinha() {
    // Novo item entra no topo da lista, ao lado do botão "+ Produto" — assim
    // fica visível sem rolar a tela, útil ao lançar vários itens seguidos.
    setLinhas((atual) => [linhaVazia(), ...atual]);
  }

  function removerLinha(key: string) {
    setLinhas((atual) => (atual.length > 1 ? atual.filter((l) => l.key !== key) : atual));
  }

  function atualizarLinha(key: string, patch: Partial<Linha>) {
    setLinhas((atual) => atual.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const linhasComProduto = linhas.filter((l) => l.produto !== null);

  // Desconto/acréscimo total, só uma prévia pro usuário — quem decide de
  // verdade é o server, recalculando a partir de precoOriginal +
  // modoAjuste/formatoAjuste/valorAjuste enviados (nunca confiamos num preço
  // final computado no client).
  const resultadoAjuste = calcularAjusteTotal(
    linhasComProduto.map((l) => ({ quantidade: Number(l.quantidade) || 0, precoDeclarado: Number(l.precoVenda) || 0 })),
    { modo: modoAjuste, formato: formatoAjuste, valor: Number(valorAjuste) || 0 }
  );

  const totalEntrada = linhasComProduto.reduce(
    (acc, l) => acc + (Number(l.quantidade) || 0) * (Number(l.custoUnitario) || 0),
    0
  );

  const itensSerializados = JSON.stringify(
    linhasComProduto.map((l) => ({
      produtoId: l.produto!.id,
      quantidade: l.quantidade,
      ...(ehEntrada ? { custoUnitario: l.custoUnitario } : {}),
      ...(ehVenda ? { precoOriginal: l.precoVenda || undefined } : {}),
    }))
  );

  const precoFinalPorLinha = new Map(
    linhasComProduto.map((l, idx) => [l.key, resultadoAjuste.precosFinais[idx]])
  );

  return (
    <>
    <form id="lancamento-form" action={formAction} className="max-w-lg space-y-6">
      <input type="hidden" name="tipo" value={tipoMovimento} />
      <input type="hidden" name="itens" value={itensSerializados} />
      <input type="hidden" name="modoAjuste" value={modoAjuste} />
      <input type="hidden" name="formatoAjuste" value={formatoAjuste} />
      <input type="hidden" name="valorAjuste" value={valorAjuste || "0"} />

      <div className="space-y-2">
        <Label htmlFor="tipoMovimentoSelect" className={labelClass}>Tipo de Lançamento</Label>
        {editando ? (
          <p className="rounded-md border border-border bg-muted px-3.5 py-2.5 text-base">
            {TIPOS_LABEL[tipoMovimento]}
          </p>
        ) : (
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
        )}
      </div>

      {ehTransferencia ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="depositoOrigemId" className={labelClass}>Depósito de Origem</Label>
            <Select
              name="depositoOrigemId"
              value={depositoOrigemId}
              items={depositosItems}
              onValueChange={(valor) => setDepositoOrigemId(valor ?? "")}
            >
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
            <Select name="depositoDestinoId" defaultValue={defaultValues?.depositoDestinoId ?? undefined} items={depositosItems}>
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
          <Select
            name="depositoId"
            value={depositoId}
            items={depositosItems}
            onValueChange={(valor) => setDepositoId(valor ?? "")}
          >
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
          <Select name="fornecedorId" defaultValue={defaultValues?.fornecedorId ?? undefined} items={fornecedoresItems}>
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
        <>
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
        </>
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
                items={produtosParaEscolher}
                value={linha.produto}
                onValueChange={(item: Item | null) =>
                  atualizarLinha(linha.key, {
                    produto: item,
                    ...(ehVenda && item ? { precoVenda: sugerirPreco(item.id) } : {}),
                  })
                }
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

              {ehVenda && modoAjuste !== "nenhum" && linha.produto && (
                <p className="text-xs text-muted-foreground">
                  Preço final (com {modoAjuste === "desconto" ? "desconto" : "acréscimo"}):{" "}
                  <span className="font-semibold text-foreground">
                    {formatarMoeda(precoFinalPorLinha.get(linha.key) ?? 0)}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>

      {ehEntrada && linhasComProduto.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatarMoeda(totalEntrada)}</span>
          </div>
        </div>
      )}

      {ehVenda && linhasComProduto.length > 0 && (
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

      <div className="space-y-2">
        <Label htmlFor="observacao" className={labelClass}>Observação</Label>
        <Input id="observacao" name="observacao" defaultValue={defaultValues?.observacao ?? ""} className={inputClass} />
      </div>

      {state.erro && <p role="alert" className="text-sm text-destructive">{state.erro}</p>}
      <div className="h-16" />
    </form>
    <div className="fixed bottom-[57px] left-0 right-0 z-30 mx-auto flex w-full max-w-[400px] items-center gap-2 overflow-x-auto border-t border-border bg-card px-[18px] py-2.5 [scrollbar-width:none]">
      {acoesExtras}
      <Button type="submit" form="lancamento-form" disabled={pending} size="sm" className="flex-none whitespace-nowrap">
        {pending ? "Salvando..." : "Salvar"}
      </Button>
      <Button type="button" variant="outline" size="sm" render={<Link href="/lancamentos" />} className="flex-none whitespace-nowrap">
        Voltar
      </Button>
    </div>
    </>
  );
}
