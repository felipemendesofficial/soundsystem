import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { obterDadosFormularioLancamento } from "../../lancamentos-financeiros/dados-formulario";
import { atualizarLancamentoFinanceiroRecorrente } from "../actions";
import { RecorrenteForm, type RecorrenteDefaultValues } from "../recorrente-form";

function formatarData(data: Date) {
  return data.toISOString().slice(0, 10);
}

export default async function EditarRecorrentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const grupoId = session.user.grupoId!;
  const empresaId = session.user.empresaId!;

  const recorrente = await db.lancamentoFinanceiroRecorrente.findFirst({
    where: { id, empresaId },
    include: { rateiosPlano: { include: { rateiosCentroCusto: true } }, rateiosProcesso: true },
  });
  if (!recorrente) notFound();

  const dados = await obterDadosFormularioLancamento(grupoId, empresaId);

  const defaultValues: RecorrenteDefaultValues = {
    tipo: recorrente.tipo,
    descricao: recorrente.descricao,
    clienteId: recorrente.clienteId,
    fornecedorId: recorrente.fornecedorId,
    tipoDocumento: recorrente.tipoDocumento,
    contaPrevistaId: recorrente.contaPrevistaId,
    processoId: recorrente.processoId,
    natureza: recorrente.natureza,
    periodicidade: recorrente.periodicidade,
    diaVencimento: recorrente.diaVencimento,
    dataInicio: formatarData(recorrente.dataInicio),
    dataFim: recorrente.dataFim ? formatarData(recorrente.dataFim) : "",
    rateioPlano: recorrente.rateiosPlano.map((r) => ({
      planoId: r.planoId,
      percentual: r.percentual.toString(),
      centroCusto: r.rateiosCentroCusto.map((cc) => ({ centroCustoId: cc.centroCustoId, percentual: cc.percentual.toString() })),
    })),
    rateioProcesso: recorrente.rateiosProcesso.map((r) => ({ processoItemId: r.processoItemId, percentual: r.percentual.toString() })),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar Lançamento Recorrente</h1>
      <RecorrenteForm
        action={atualizarLancamentoFinanceiroRecorrente.bind(null, id)}
        clientes={dados.clientes}
        fornecedores={dados.fornecedores}
        contasFinanceiras={dados.contasFinanceiras}
        processos={dados.processos}
        planoFinanceiro={dados.planoFinanceiro}
        centroCusto={dados.centroCusto}
        processoItens={dados.processoItens}
        defaultValues={defaultValues}
      />
    </div>
  );
}
