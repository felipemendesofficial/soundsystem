import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeVerCusto } from "@/lib/permissions";
import { obterUltimosPrecosVenda } from "@/lib/tabela-preco";
import { Badge } from "@/components/ui/badge";
import { LancamentoForm } from "@/components/lancamento-form";
import { LancamentoStatusActions } from "@/components/lancamento-status-actions";
import {
  atualizarLancamento,
  cancelarFechamentoLancamento,
  excluirLancamento,
  finalizarLancamento,
} from "../actions";

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  fechado: "Fechado",
};

const TIPO_LABEL: Record<string, string> = {
  compra: "Compra",
  devolucao_cliente: "Devolução de Cliente",
  ajuste_entrada: "Ajuste (Entrada)",
  venda: "Venda",
  devolucao_fornecedor: "Devolução a Fornecedor",
  perda_avaria: "Perda / Avaria",
  uso_interno: "Uso Interno",
  ajuste_saida: "Ajuste (Saída)",
  transferencia: "Transferência",
};

const ENTRADA_TIPOS = new Set(["compra", "devolucao_cliente", "ajuste_entrada"]);
const VENDA_TIPOS = new Set(["venda"]);

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function DetalheLancamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const perfil = session!.user.perfil;
  const mostrarCusto = podeVerCusto(perfil);

  const [lancamento, produtos, depositos, fornecedores, clientes, vendedores, tabelasPreco, itensTabelaPreco, ultimosPrecos] =
    await Promise.all([
      db.lancamento.findUnique({
        where: { id },
        include: {
          itens: { include: { produto: true } },
          deposito: true,
          depositoOrigem: true,
          depositoDestino: true,
          fornecedor: true,
          cliente: true,
          vendedor: true,
        },
      }),
      db.produto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      db.deposito.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      db.fornecedor.findMany({ orderBy: { nome: "asc" } }),
      db.cliente.findMany({ orderBy: { nome: "asc" } }),
      db.vendedor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      db.tabelaPreco.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
      db.itemTabelaPreco.findMany(),
      obterUltimosPrecosVenda(),
    ]);
  if (!lancamento) notFound();

  const precosPorTabela: Record<string, Record<string, number>> = {};
  for (const item of itensTabelaPreco) {
    precosPorTabela[item.tabelaPrecoId] ??= {};
    precosPorTabela[item.tabelaPrecoId][item.produtoId] = Number(item.preco);
  }

  const editavel = lancamento.status === "aberto";
  const ehEntrada = ENTRADA_TIPOS.has(lancamento.tipo);
  const ehVenda = VENDA_TIPOS.has(lancamento.tipo);

  const total = lancamento.itens.reduce((acc, i) => {
    const preco = ehEntrada ? Number(i.custoUnitario ?? 0) : Number(i.precoVenda ?? 0);
    return acc + Number(i.quantidade) * preco;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Lançamento #{lancamento.numero}</h1>
          <p className="text-sm text-muted-foreground">{TIPO_LABEL[lancamento.tipo]}</p>
        </div>
        <Badge variant={lancamento.status === "fechado" ? "default" : "secondary"}>
          {STATUS_LABEL[lancamento.status]}
        </Badge>
      </div>

      <LancamentoStatusActions
        status={lancamento.status}
        tipo={lancamento.tipo}
        finalizarAction={finalizarLancamento.bind(null, id)}
        cancelarFechamentoAction={cancelarFechamentoLancamento.bind(null, id)}
        excluirAction={excluirLancamento.bind(null, id)}
      />

      {editavel ? (
        <LancamentoForm
          action={atualizarLancamento.bind(null, id)}
          produtos={produtos.map((p) => ({ id: p.id, label: `${p.nome} — ${p.sku}` }))}
          depositos={depositos.map((d) => ({ id: d.id, label: d.nome }))}
          fornecedores={fornecedores.map((f) => ({ id: f.id, label: f.nome }))}
          clientes={clientes.map((c) => ({ id: c.id, label: c.nome, tabelaPrecoPadraoId: c.tabelaPrecoPadraoId }))}
          vendedores={vendedores.map((v) => ({ id: v.id, label: v.nome }))}
          tabelasPreco={tabelasPreco.map((t) => ({ id: t.id, label: t.nome }))}
          precosPorTabela={precosPorTabela}
          ultimosPrecosVenda={Object.fromEntries(ultimosPrecos)}
          perfil={perfil}
          defaultValues={{
            tipo: lancamento.tipo,
            depositoId: lancamento.depositoId,
            depositoOrigemId: lancamento.depositoOrigemId,
            depositoDestinoId: lancamento.depositoDestinoId,
            fornecedorId: lancamento.fornecedorId,
            clienteId: lancamento.clienteId,
            vendedorId: lancamento.vendedorId,
            observacao: lancamento.observacao,
            itens: lancamento.itens.map((i) => ({
              produtoId: i.produtoId,
              label: `${i.produto.nome} — ${i.produto.sku}`,
              quantidade: i.quantidade.toString(),
              custoUnitario: i.custoUnitario?.toString() ?? "0",
              precoVenda: i.precoVenda?.toString() ?? "",
            })),
          }}
        />
      ) : (
        <div className="max-w-lg space-y-6">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <div className="mb-1 truncate text-[13px] text-muted-foreground">Depósito</div>
                <div className="truncate text-[15.5px] font-medium">
                  {lancamento.tipo === "transferencia"
                    ? `${lancamento.depositoOrigem?.nome ?? "-"} → ${lancamento.depositoDestino?.nome ?? "-"}`
                    : (lancamento.deposito?.nome ?? "-")}
                </div>
              </div>
              {lancamento.fornecedor && (
                <div className="min-w-0">
                  <div className="mb-1 truncate text-[13px] text-muted-foreground">Fornecedor</div>
                  <div className="truncate text-[15.5px] font-medium">{lancamento.fornecedor.nome}</div>
                </div>
              )}
              {lancamento.cliente && (
                <div className="min-w-0">
                  <div className="mb-1 truncate text-[13px] text-muted-foreground">Cliente</div>
                  <div className="truncate text-[15.5px] font-medium">{lancamento.cliente.nome}</div>
                </div>
              )}
              {lancamento.vendedor && (
                <div className="min-w-0">
                  <div className="mb-1 truncate text-[13px] text-muted-foreground">Vendedor</div>
                  <div className="truncate text-[15.5px] font-medium">{lancamento.vendedor.nome}</div>
                </div>
              )}
              {lancamento.observacao && (
                <div className="min-w-0">
                  <div className="mb-1 truncate text-[13px] text-muted-foreground">Observação</div>
                  <div className="truncate text-[15.5px] font-medium">{lancamento.observacao}</div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-[13px] font-medium uppercase text-muted-foreground">Itens</div>
              <ul className="space-y-2">
                {lancamento.itens.map((i) => (
                  <li key={i.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                    <span>
                      {i.produto.nome} × {Number(i.quantidade)}
                    </span>
                    {(ehEntrada ? mostrarCusto : ehVenda) && (
                      <span className="font-medium">
                        {formatarMoeda(Number(i.quantidade) * Number(ehEntrada ? (i.custoUnitario ?? 0) : (i.precoVenda ?? 0)))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {(ehEntrada ? mostrarCusto : ehVenda) && (
              <p className="mt-4 text-right text-base font-semibold">Total: {formatarMoeda(total)}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
