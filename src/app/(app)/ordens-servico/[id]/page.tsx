import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { OSForm } from "@/components/os-form";
import { OSStatusActions } from "@/components/os-status-actions";
import {
  atualizarOrdemServico,
  cancelarOrdemServico,
  concluirOrdemServico,
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

  const [os, clientes, depositos, produtos, servicos] = await Promise.all([
    db.ordemServico.findUnique({
      where: { id },
      include: {
        cliente: true,
        deposito: true,
        itensProduto: { include: { produto: true } },
        itensServico: { include: { servico: true } },
      },
    }),
    db.cliente.findMany({ orderBy: { nome: "asc" } }),
    db.deposito.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    db.produto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    db.servico.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
  ]);
  if (!os) notFound();

  const editavel = os.status === "aberta" || os.status === "em_andamento";

  const totalProdutos = os.itensProduto.reduce((acc, i) => acc + Number(i.quantidade) * Number(i.precoUnitario), 0);
  const totalServicos = os.itensServico.reduce((acc, i) => acc + Number(i.quantidade) * Number(i.precoUnitario), 0);
  const total = totalProdutos + totalServicos;

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

      <OSStatusActions
        status={os.status}
        iniciarAction={iniciarOrdemServico.bind(null, id)}
        concluirAction={concluirOrdemServico.bind(null, id)}
        cancelarAction={cancelarOrdemServico.bind(null, id)}
      />

      {editavel ? (
        <OSForm
          action={atualizarOrdemServico.bind(null, id)}
          clientes={clientes.map((c) => ({ id: c.id, label: c.nome }))}
          depositos={depositos.map((d) => ({ id: d.id, label: d.nome }))}
          produtos={produtos.map((p) => ({ id: p.id, label: `${p.nome} — ${p.sku}` }))}
          servicos={servicos.map((s) => ({ id: s.id, label: s.nome, precoPadrao: Number(s.precoPadrao) }))}
          defaultValues={{
            clienteId: os.clienteId,
            depositoId: os.depositoId,
            observacao: os.observacao,
            itens: [
              ...os.itensServico.map((i) => ({
                tipo: "servico" as const,
                itemId: i.servicoId,
                label: i.servico.nome,
                quantidade: i.quantidade.toString(),
                precoUnitario: i.precoUnitario.toString(),
              })),
              ...os.itensProduto.map((i) => ({
                tipo: "produto" as const,
                itemId: i.produtoId,
                label: `${i.produto.nome} — ${i.produto.sku}`,
                quantidade: i.quantidade.toString(),
                precoUnitario: i.precoUnitario.toString(),
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
                {os.itensServico.map((i) => (
                  <li key={i.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                    <span>
                      {i.servico.nome} × {Number(i.quantidade)}
                    </span>
                    <span className="font-medium">{formatarMoeda(Number(i.quantidade) * Number(i.precoUnitario))}</span>
                  </li>
                ))}
                {os.itensProduto.map((i) => (
                  <li key={i.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                    <span>
                      {i.produto.nome} × {Number(i.quantidade)}
                    </span>
                    <span className="font-medium">{formatarMoeda(Number(i.quantidade) * Number(i.precoUnitario))}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-4 text-right text-base font-semibold">Total: {formatarMoeda(total)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
