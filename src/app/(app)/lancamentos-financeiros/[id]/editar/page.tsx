import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { atualizarLancamentoFinanceiro } from "../../actions";
import { obterDadosFormularioLancamento } from "../../dados-formulario";
import { LancamentoFinanceiroForm, type LancamentoFinanceiroDefaultValues } from "../../lancamento-financeiro-form";

function formatarData(data: Date) {
  return data.toISOString().slice(0, 10);
}

export default async function EditarLancamentoFinanceiroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const grupoId = session.user.grupoId!;
  const empresaId = session.user.empresaId!;

  const lancamento = await db.lancamentoFinanceiro.findFirst({
    where: { id, empresaId },
    include: {
      rateios: { include: { rateiosCentroCusto: true } },
      rateiosProcesso: true,
      retencoes: true,
      comissoes: true,
      dadosCheque: true,
      dadosCartao: true,
    },
  });
  if (!lancamento) notFound();
  if (lancamento.status !== "aberto") redirect(`/lancamentos-financeiros/${id}`);

  const dados = await obterDadosFormularioLancamento(grupoId, empresaId);

  const defaultValues: LancamentoFinanceiroDefaultValues = {
    tipo: lancamento.tipo,
    natureza: lancamento.natureza,
    historicoSimplificado: lancamento.historicoSimplificado,
    historicoComplementar: lancamento.historicoComplementar ?? "",
    documento: lancamento.documento ?? "",
    documentoFisico: lancamento.documentoFisico,
    tipoDocumento: lancamento.tipoDocumento,
    portadorId: lancamento.portadorId,
    contaPrevistaId: lancamento.contaPrevistaId,
    clienteId: lancamento.clienteId,
    fornecedorId: lancamento.fornecedorId,
    valorOriginal: lancamento.valorOriginal.toString(),
    moraMes: lancamento.moraMes?.toString() ?? "",
    dataEmissao: formatarData(lancamento.dataEmissao),
    dataVencimento: formatarData(lancamento.dataVencimento),
    processoId: lancamento.processoId,
    observacao: lancamento.observacao ?? "",
    rateioPlano: lancamento.rateios.map((r) => ({
      planoId: r.planoId,
      percentual: r.percentual.toString(),
      centroCusto: r.rateiosCentroCusto.map((cc) => ({
        centroCustoId: cc.centroCustoId,
        percentual: cc.percentual.toString(),
      })),
    })),
    rateioProcesso: lancamento.rateiosProcesso.map((r) => ({
      processoItemId: r.processoItemId,
      percentual: r.percentual.toString(),
    })),
    retencoes: lancamento.retencoes.map((r) => ({ planoId: r.planoId, percentual: r.percentual.toString() })),
    comissoes: lancamento.comissoes.map((c) => ({ vendedorId: c.vendedorId, percentual: c.percentual.toString() })),
    chequeBanco: lancamento.dadosCheque?.banco ?? "",
    chequeAgencia: lancamento.dadosCheque?.agencia ?? "",
    chequeNumeroCheque: lancamento.dadosCheque?.numeroCheque ?? "",
    chequeContaCorrente: lancamento.dadosCheque?.contaCorrente ?? "",
    chequeCgc: lancamento.dadosCheque?.cgc ?? "",
    chequeCpf: lancamento.dadosCheque?.cpf ?? "",
    chequeTelefone: lancamento.dadosCheque?.telefone ?? "",
    chequeTerceiro: lancamento.dadosCheque?.terceiro ?? "",
    cartaoOperadoraId: lancamento.dadosCartao?.operadoraId ?? null,
    cartaoOperadoraCartaoTaxaId: lancamento.dadosCartao?.operadoraCartaoTaxaId ?? null,
    cartaoNumeroCartao: lancamento.dadosCartao?.numeroCartao ?? "",
    cartaoNumeroAutorizacao: lancamento.dadosCartao?.numeroAutorizacao ?? "",
    cartaoTipoTaxa: lancamento.dadosCartao?.tipoTaxa ?? "",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar Lançamento Financeiro</h1>
      <LancamentoFinanceiroForm action={atualizarLancamentoFinanceiro.bind(null, id)} {...dados} defaultValues={defaultValues} />
    </div>
  );
}
