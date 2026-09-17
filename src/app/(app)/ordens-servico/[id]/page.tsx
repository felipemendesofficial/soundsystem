import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { obterUltimosPrecosVenda } from "@/lib/tabela-preco";
import { obterProdutosComEstoquePorDeposito } from "@/lib/estoque-disponivel";
import { Badge } from "@/components/ui/badge";
import { OSForm } from "@/components/os-form";
import { OSStatusActions } from "@/components/os-status-actions";
import {
  atualizarOrdemServico,
  cancelarOrdemServico,
  concluirOrdemServico,
  estornarConclusaoOrdemServico,
  iniciarOrdemServico,
} from "../actions";

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function DetalheOrdemServicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const grupoId = session!.user.grupoId!;
  const empresaId = session!.user.empresaId!;

  const [os, clientes, depositos, vendedores, produtos, servicos, tabelasPreco, itensTabelaPreco, ultimosPrecos, produtosComEstoquePorDeposito] =
    await Promise.all([
      db.ordemServico.findFirst({
        where: { id, empresaId },
        include: {
          cliente: true,
          deposito: true,
          vendedor: true,
          itensProduto: { include: { produto: true } },
          itensServico: { include: { servico: true } },
        },
      }),
      db.cliente.findMany({ where: { grupoId }, orderBy: { nome: "asc" } }),
      db.deposito.findMany({ where: { ativo: true, empresaId }, orderBy: { nome: "asc" } }),
      db.vendedor.findMany({ where: { ativo: true, grupoId }, orderBy: { nome: "asc" } }),
      db.produto.findMany({ where: { ativo: true, grupoId }, orderBy: { nome: "asc" } }),
      db.servico.findMany({ where: { ativo: true, grupoId }, orderBy: { nome: "asc" } }),
      db.tabelaPreco.findMany({ where: { ativo: true, grupoId }, orderBy: { nome: "asc" } }),
      db.itemTabelaPreco.findMany({ where: { tabelaPreco: { grupoId } } }),
      obterUltimosPrecosVenda(empresaId),
      obterProdutosComEstoquePorDeposito(empresaId),
    ]);
  if (!os) notFound();

  const precosPorTabela: Record<string, Record<string, number>> = {};
  for (const item of itensTabelaPreco) {
    precosPorTabela[item.tabelaPrecoId] ??= {};
    precosPorTabela[item.tabelaPrecoId][item.produtoId] = Number(item.preco);
  }

  const editavel = os.status === "aberta" || os.status === "em_andamento";

  const totalProdutos = os.itensProduto.reduce((acc, i) => acc + Number(i.quantidade) * Number(i.precoUnitario), 0);
  const totalServicos = os.itensServico.reduce((acc, i) => acc + Number(i.quantidade) * Number(i.precoUnitario), 0);
  const total = totalProdutos + totalServicos;
  // Bruto = precoOriginal (nunca tocado pelo desconto/acréscimo da OS).
  const totalBruto =
    os.itensProduto.reduce((acc, i) => acc + Number(i.quantidade) * Number(i.precoOriginal), 0) +
    os.itensServico.reduce((acc, i) => acc + Number(i.quantidade) * Number(i.precoOriginal), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">OS #{os.numero}</h1>
          <p className="text-sm text-muted-foreground">{os.cliente.nome}</p>
        </div>
        <Badge variant={os.status === "cancelada" ? "destructive" : os.status === "concluida" ? "default" : "secondary"}>
          {STATUS_LABEL[os.status]}
        </Badge>
      </div>

      {editavel ? (
        <OSForm
          action={atualizarOrdemServico.bind(null, id)}
          clientes={clientes.map((c) => ({ id: c.id, label: c.nome, tabelaPrecoPadraoId: c.tabelaPrecoPadraoId }))}
          depositos={depositos.map((d) => ({ id: d.id, label: d.nome }))}
          vendedores={vendedores.map((v) => ({ id: v.id, label: v.nome }))}
          produtos={produtos.map((p) => ({ id: p.id, label: `${p.nome} — ${p.sku}`, controlaEstoque: p.controlaEstoque }))}
          servicos={servicos.map((s) => ({ id: s.id, label: s.nome, precoPadrao: Number(s.precoPadrao) }))}
          tabelasPreco={tabelasPreco.map((t) => ({ id: t.id, label: t.nome }))}
          precosPorTabela={precosPorTabela}
          ultimosPrecosVenda={Object.fromEntries(ultimosPrecos)}
          produtosComEstoquePorDeposito={produtosComEstoquePorDeposito}
          acoesExtras={
            <OSStatusActions
              status={os.status}
              iniciarAction={iniciarOrdemServico.bind(null, id)}
              concluirAction={concluirOrdemServico.bind(null, id)}
              cancelarAction={cancelarOrdemServico.bind(null, id)}
              estornarAction={estornarConclusaoOrdemServico.bind(null, id)}
            />
          }
          defaultValues={{
            clienteId: os.clienteId,
            depositoId: os.depositoId,
            vendedorId: os.vendedorId,
            observacao: os.observacao,
            modoAjuste: os.modoAjuste,
            formatoAjuste: os.formatoAjuste,
            valorAjuste: os.valorAjuste.toString(),
            itens: [
              ...os.itensServico.map((i) => ({
                tipo: "servico" as const,
                itemId: i.servicoId,
                label: i.servico.nome,
                quantidade: i.quantidade.toString(),
                precoOriginal: i.precoOriginal.toString(),
              })),
              ...os.itensProduto.map((i) => ({
                tipo: "produto" as const,
                itemId: i.produtoId,
                label: `${i.produto.nome} — ${i.produto.sku}`,
                quantidade: i.quantidade.toString(),
                precoOriginal: i.precoOriginal.toString(),
              })),
            ],
          }}
        />
      ) : (
        <div className="max-w-lg space-y-6">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <div className="mb-1 truncate text-[13px] text-muted-foreground">Depósito</div>
                <div className="truncate text-[15.5px] font-medium">{os.deposito.nome}</div>
              </div>
              <div className="min-w-0">
                <div className="mb-1 truncate text-[13px] text-muted-foreground">Vendedor</div>
                <div className="truncate text-[15.5px] font-medium">{os.vendedor.nome}</div>
              </div>
              {os.observacao && (
                <div className="min-w-0">
                  <div className="mb-1 truncate text-[13px] text-muted-foreground">Observação</div>
                  <div className="truncate text-[15.5px] font-medium">{os.observacao}</div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-[13px] font-medium uppercase text-muted-foreground">Itens</div>
              <ul className="space-y-2">
                {os.itensServico.map((i) => {
                  const qtd = Number(i.quantidade);
                  const bruto = qtd * Number(i.precoOriginal);
                  const liquido = qtd * Number(i.precoUnitario);
                  const ajuste = liquido - bruto;
                  return (
                    <li key={i.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span>
                          {i.servico.nome} × {qtd}
                        </span>
                        <span className="font-medium">{formatarMoeda(liquido)}</span>
                      </div>
                      {ajuste !== 0 && (
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Bruto: {formatarMoeda(bruto)}</span>
                          <span>
                            {ajuste < 0 ? "Desconto" : "Acréscimo"}: {ajuste < 0 ? "−" : "+"}
                            {formatarMoeda(Math.abs(ajuste))}
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
                {os.itensProduto.map((i) => {
                  const qtd = Number(i.quantidade);
                  const bruto = qtd * Number(i.precoOriginal);
                  const liquido = qtd * Number(i.precoUnitario);
                  const ajuste = liquido - bruto;
                  return (
                    <li key={i.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span>
                          {i.produto.nome} × {qtd}
                        </span>
                        <span className="font-medium">{formatarMoeda(liquido)}</span>
                      </div>
                      {ajuste !== 0 && (
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Bruto: {formatarMoeda(bruto)}</span>
                          <span>
                            {ajuste < 0 ? "Desconto" : "Acréscimo"}: {ajuste < 0 ? "−" : "+"}
                            {formatarMoeda(Math.abs(ajuste))}
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
              {totalBruto !== total && (
                <>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Bruto</span>
                    <span>{formatarMoeda(totalBruto)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>{os.modoAjuste === "acrescimo" ? "Acréscimo" : "Desconto"}</span>
                    <span>
                      {os.modoAjuste === "acrescimo" ? "+" : "−"}
                      {formatarMoeda(Math.abs(totalBruto - total))}
                    </span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Líquido</span>
                <span>{formatarMoeda(total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {os.status === "concluida" && (
        <>
          <div className="h-16" />
          <div className="fixed bottom-[57px] left-0 right-0 z-30 mx-auto flex w-full max-w-[400px] items-center gap-2 overflow-x-auto border-t border-border bg-card px-[18px] py-2.5 [scrollbar-width:none]">
            <OSStatusActions
              status={os.status}
              iniciarAction={iniciarOrdemServico.bind(null, id)}
              concluirAction={concluirOrdemServico.bind(null, id)}
              cancelarAction={cancelarOrdemServico.bind(null, id)}
              estornarAction={estornarConclusaoOrdemServico.bind(null, id)}
            />
          </div>
        </>
      )}
    </div>
  );
}
