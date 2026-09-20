import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { erroContaParaBaixa } from "@/lib/regras-conta-baixa";
import { darBaixaLancamento } from "../../actions";
import { BaixaForm } from "./baixa-form";

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function BaixaLancamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;
  const grupoId = session.user.grupoId!;

  const lancamento = await db.lancamentoFinanceiro.findFirst({ where: { id, empresaId } });
  if (!lancamento) notFound();
  if (lancamento.status !== "aberto") redirect(`/lancamentos-financeiros/${id}`);
  if (lancamento.natureza === "prevista") redirect(`/lancamentos-financeiros/${id}`);

  const [contasCadastradas, terceiro, parametro, chequesDisponiveis] = await Promise.all([
    db.contaFinanceira.findMany({ where: { empresaId, ativo: true }, orderBy: { nome: "asc" } }),
    lancamento.tipo === "receita"
      ? lancamento.clienteId
        ? db.cliente.findFirst({ where: { id: lancamento.clienteId, grupoId } })
        : null
      : lancamento.fornecedorId
        ? db.fornecedor.findFirst({ where: { id: lancamento.fornecedorId, grupoId } })
        : null,
    db.parametroFinanceiro.findUnique({ where: { empresaId } }),
    // Só faz sentido oferecer pra despesa — filtra por tipo de novo dentro do form/action.
    lancamento.tipo === "despesa"
      ? db.baixa.findMany({
          where: {
            estornada: false,
            utilizadoComoChequeEm: null,
            conta: { tipo: "caixa" },
            lancamento: { empresaId, tipo: "receita", tipoDocumento: { in: ["cheque_vista", "cheque_prazo"] } },
          },
          include: { lancamento: { include: { dadosCheque: true, cliente: true } } },
          orderBy: { dataBaixa: "desc" },
        })
      : [],
  ]);

  const contas = contasCadastradas
    .filter((c) => !erroContaParaBaixa(c, { tipoLancamento: lancamento.tipo, tipoDocumento: lancamento.tipoDocumento }))
    .map((c) => ({
      id: c.id,
      label: c.nome,
      tipo: c.tipo,
      adiantamentoCliente: c.adiantamentoCliente,
      adiantamentoFornecedor: c.adiantamentoFornecedor,
    }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dar Baixa</h1>
      <div className="space-y-1 text-sm">
        <p className="font-medium text-foreground">{lancamento.historicoSimplificado}</p>
        <p className="text-muted-foreground">
          {lancamento.tipo === "receita" ? "Receita" : "Despesa"} · Vencimento {formatarData(lancamento.dataVencimento)}
        </p>
      </div>
      <BaixaForm
        action={darBaixaLancamento.bind(null, id)}
        cancelarHref={`/lancamentos-financeiros/${id}`}
        contas={contas}
        contaPrevistaId={lancamento.contaPrevistaId}
        valorOriginal={Number(lancamento.valorOriginal)}
        dataVencimento={lancamento.dataVencimento.toISOString().slice(0, 10)}
        moraMes={lancamento.moraMes ? Number(lancamento.moraMes) : null}
        tipoLancamento={lancamento.tipo}
        terceiroLabel={terceiro?.nome ?? null}
        percentualMulta={parametro?.percentualMultaPadrao ? Number(parametro.percentualMultaPadrao) : null}
        chequesDisponiveis={chequesDisponiveis.map((b) => ({
          id: b.id,
          valor: Number(b.valorBaixado),
          label: `${b.lancamento.dadosCheque?.numeroCheque ? `Cheque ${b.lancamento.dadosCheque.numeroCheque} · ` : ""}${b.lancamento.cliente?.nome ?? b.lancamento.historicoSimplificado} · ${formatarMoeda(b.valorBaixado)}`,
        }))}
      />
    </div>
  );
}
