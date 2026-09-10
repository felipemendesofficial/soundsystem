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
import { calcularAjusteTotal, type FormatoAjuste, type ModoAjuste } from "@/lib/ajuste-total";

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

export function MovimentacaoForm({
  produtos,
  depositos,
  fornecedores,
  clientes,
  vendedores,
  tabelasPreco,
  precosPorTabela,
  ultimosPrecosVenda,
  perfil,
  depositoPadraoId,
}: {
  produtos: Item[];
  depositos: Item[];
  fornecedores: Item[];
  clientes: ClienteItem[];
  vendedores: VendedorItem[];
  tabelasPreco: Item[];
  precosPorTabela: Record<string, Record<string, number>>;
  ultimosPrecosVenda: Record<string, number>;
  perfil: string;
  depositoPadraoId: string | null;
}) {
  const tiposDisponiveis = perfil === "vendedor" ? ["venda"] : TODOS_OS_TIPOS;
  const [tipoMovimento, setTipoMovimento] = useState(tiposDisponiveis[0]);
  const [state, formAction, pending] = useActionState(registrarMovimento, estadoInicial);
  const [linhas, setLinhas] = useState<Linha[]>(() => [linhaVazia()]);
  // "" (nunca undefined) mesmo sem seleção — Select vira controlado assim que
  // recebe `value`; alternar de undefined pra string depois dispara warning
  // do React de componente trocando de não-controlado pra controlado.
  const [clienteId, setClienteId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [tabelaPrecoId, setTabelaPrecoId] = useState("");
  const [modoAjuste, setModoAjuste] = useState<ModoAjuste>("nenhum");
  const [formatoAjuste, setFormatoAjuste] = useState<FormatoAjuste>("percentual");
  const [valorAjuste, setValorAjuste] = useState("");

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

  // Desconto/acréscimo total da venda, redistribuído proporcionalmente entre
  // os itens — o preço declarado em cada linha continua editável e visível;
  // o "preço final" abaixo é só quem realmente vai no envio.
  const resultadoAjuste = calcularAjusteTotal(
    linhasComProduto.map((l) => ({ quantidade: Number(l.quantidade) || 0, precoDeclarado: Number(l.precoVenda) || 0 })),
    { modo: modoAjuste, formato: formatoAjuste, valor: Number(valorAjuste) || 0 }
  );

  const itensSerializados = JSON.stringify(
    linhasComProduto.map((l, idx) => ({
      produtoId: l.produto!.id,
      quantidade: l.quantidade,
      ...(ehEntrada ? { custoUnitario: l.custoUnitario } : {}),
      ...(ehVenda
        ? {
            precoVenda:
              modoAjuste !== "nenhum"
                ? String(resultadoAjuste.precosFinais[idx])
                : l.precoVenda || undefined,
          }
        : {}),
    }))
  );

  const precoFinalPorLinha = new Map(
    linhasComProduto.map((l, idx) => [l.key, resultadoAjuste.precosFinais[idx]])
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
                items={produtos}
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

              <div className="space-y-1 border-t border-border pt-3 text-sm">
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
                <div className="flex items-center justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{formatarMoeda(resultadoAjuste.total)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

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
