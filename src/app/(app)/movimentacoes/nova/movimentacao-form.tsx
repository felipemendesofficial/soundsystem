"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const tiposItems = Object.fromEntries(tiposDisponiveis.map((tipo) => [tipo, TIPOS_LABEL[tipo]]));
  const produtosItems = Object.fromEntries(produtos.map((p) => [p.id, p.label]));
  const depositosItems = Object.fromEntries(depositos.map((d) => [d.id, d.label]));
  const fornecedoresItems = Object.fromEntries(fornecedores.map((f) => [f.id, f.label]));
  const clientesItems = Object.fromEntries(clientes.map((c) => [c.id, c.label]));

  const ehEntrada = ENTRADA_TIPOS.has(tipoMovimento);
  const ehSaida = SAIDA_TIPOS.has(tipoMovimento);
  const ehVenda = tipoMovimento === "venda";
  const ehTransferencia = tipoMovimento === "transferencia";

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <input type="hidden" name="tipoMovimento" value={tipoMovimento} />

      <div className="space-y-2">
        <Label htmlFor="tipoMovimentoSelect">Tipo de Movimento</Label>
        <Select
          value={tipoMovimento}
          items={tiposItems}
          onValueChange={(valor) => {
            if (valor) setTipoMovimento(valor);
          }}
        >
          <SelectTrigger id="tipoMovimentoSelect" className="w-full">
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

      <div className="space-y-2">
        <Label htmlFor="produtoId">Produto</Label>
        <Select name="produtoId" items={produtosItems}>
          <SelectTrigger id="produtoId" className="w-full">
            <SelectValue placeholder="Selecione o produto" />
          </SelectTrigger>
          <SelectContent>
            {produtos.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ehTransferencia ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="depositoOrigemId">Depósito de Origem</Label>
            <Select name="depositoOrigemId" defaultValue={depositoPadraoId ?? undefined} items={depositosItems}>
              <SelectTrigger id="depositoOrigemId" className="w-full">
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
            <Label htmlFor="depositoDestinoId">Depósito de Destino</Label>
            <Select name="depositoDestinoId" items={depositosItems}>
              <SelectTrigger id="depositoDestinoId" className="w-full">
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
          <Label htmlFor="depositoId">Depósito</Label>
          <Select name="depositoId" defaultValue={depositoPadraoId ?? undefined} items={depositosItems}>
            <SelectTrigger id="depositoId" className="w-full">
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

      <div className="space-y-2">
        <Label htmlFor="quantidade">Quantidade</Label>
        <Input id="quantidade" name="quantidade" type="number" step="0.001" min="0.001" required />
      </div>

      {ehEntrada && (
        <>
          <div className="space-y-2">
            <Label htmlFor="custoUnitario">Custo Unitário (R$)</Label>
            <Input id="custoUnitario" name="custoUnitario" type="number" step="0.01" min="0" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fornecedorId">Fornecedor</Label>
            <Select name="fornecedorId" items={fornecedoresItems}>
              <SelectTrigger id="fornecedorId" className="w-full">
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
        </>
      )}

      {ehSaida && ehVenda && (
        <>
          <div className="space-y-2">
            <Label htmlFor="precoVenda">Preço de Venda (R$)</Label>
            <Input id="precoVenda" name="precoVenda" type="number" step="0.01" min="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clienteId">Cliente</Label>
            <Select name="clienteId" items={clientesItems}>
              <SelectTrigger id="clienteId" className="w-full">
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
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="observacao">Observação</Label>
        <Input id="observacao" name="observacao" />
      </div>

      {state.erro && <p className="text-sm text-destructive">{state.erro}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Registrando..." : "Registrar Movimento"}
      </Button>
    </form>
  );
}
