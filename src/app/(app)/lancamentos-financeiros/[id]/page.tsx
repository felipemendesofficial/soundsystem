import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmarPrevisaoButton } from "@/components/confirmar-previsao-button";
import { ExcluirLancamentoButton } from "@/components/excluir-lancamento-button";
import { TIPOS_DOCUMENTO_LABEL, TIPOS_TAXA_CARTAO_LABEL } from "@/lib/financeiro-labels";
import { confirmarPrevisao, excluirLancamentoFinanceiro } from "../actions";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatarDataHora(data: Date) {
  return data.toLocaleString("pt-BR");
}

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  baixado: "Baixado",
  estornado: "Estornado",
  cancelado: "Cancelado",
};

export default async function LancamentoFinanceiroDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const lancamento = await db.lancamentoFinanceiro.findFirst({
    where: { id, empresaId: session.user.empresaId! },
    include: {
      cliente: true,
      fornecedor: true,
      portador: true,
      contaPrevista: true,
      processo: true,
      dadosCheque: true,
      dadosCartao: { include: { operadora: true } },
      criadoPor: true,
      atualizadoPor: true,
      rateios: { include: { plano: true, rateiosCentroCusto: { include: { centroCusto: true } } } },
      rateiosProcesso: { include: { processoItem: true } },
      retencoes: { include: { plano: true } },
      comissoes: { include: { vendedor: true } },
      baixas: {
        include: {
          conta: true,
          usuario: true,
          adiantamentoCliente: true,
          adiantamentoFornecedor: true,
          estorno: { include: { conta: true } },
          chequesUtilizados: { include: { baixaCheque: { include: { lancamento: { include: { dadosCheque: true, cliente: true } } } } } },
          utilizadoComoChequeEm: { include: { baixaDespesa: { include: { lancamento: { include: { fornecedor: true } } } } } },
        },
        orderBy: { dataBaixa: "desc" },
      },
    },
  });
  if (!lancamento) notFound();

  const contraparte = lancamento.cliente?.nome ?? lancamento.fornecedor?.nome ?? "-";
  const totalRetencoes = lancamento.retencoes.reduce((acc, r) => acc + Number(r.valor), 0);
  const baixaAtiva = lancamento.baixas.find((b) => !b.estornada);
  const podeEditar = lancamento.status === "aberto";
  const podeExcluir = lancamento.status === "aberto" && lancamento.natureza === "prevista";
  const podeConfirmarPrevisao = lancamento.status === "aberto" && lancamento.natureza === "prevista";
  const podeDarBaixa = lancamento.status === "aberto" && lancamento.natureza === "real";
  const mostrarAcoes = podeEditar || podeExcluir || podeConfirmarPrevisao || podeDarBaixa;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant={lancamento.tipo === "receita" ? "default" : "outline"}>
          {lancamento.tipo === "receita" ? "Receita" : "Despesa"}
        </Badge>
        <Badge variant={lancamento.status === "aberto" ? "secondary" : "default"}>
          {STATUS_LABEL[lancamento.status]}
        </Badge>
        <Badge variant={lancamento.natureza === "prevista" ? "outline" : "default"}>
          {lancamento.natureza === "prevista" ? "Previsão" : "Real"}
        </Badge>
      </div>

      <div className="space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Histórico</span><span className="font-medium">{lancamento.historicoSimplificado}</span></div>
        {lancamento.historicoComplementar && (
          <div className="flex justify-between"><span className="text-muted-foreground">Histórico Complementar</span><span className="font-medium">{lancamento.historicoComplementar}</span></div>
        )}
        <div className="flex justify-between"><span className="text-muted-foreground">Valor original</span><span className="font-medium">{formatarMoeda(lancamento.valorOriginal)}</span></div>
        {totalRetencoes > 0 && (
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">Retenções</span><span className="font-medium">− {formatarMoeda(totalRetencoes)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Valor líquido</span><span className="font-medium">{formatarMoeda(Number(lancamento.valorOriginal) - totalRetencoes)}</span></div>
          </>
        )}
        <div className="flex justify-between"><span className="text-muted-foreground">{lancamento.tipo === "receita" ? "Cliente" : "Fornecedor"}</span><span className="font-medium">{contraparte}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Emissão</span><span className="font-medium">{formatarData(lancamento.dataEmissao)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Vencimento</span><span className="font-medium">{formatarData(lancamento.dataVencimento)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Processo</span><span className="font-medium">{lancamento.processo.nome}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Tipo de Documento</span><span className="font-medium">{TIPOS_DOCUMENTO_LABEL[lancamento.tipoDocumento] ?? lancamento.tipoDocumento}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Documento</span><span className="font-medium">{lancamento.documento ?? "-"}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Portador</span><span className="font-medium">{lancamento.portador?.nome ?? "-"}</span></div>
        {baixaAtiva ? (
          <div className="flex justify-between"><span className="text-muted-foreground">Conta</span><span className="font-medium">{baixaAtiva.conta.nome}</span></div>
        ) : (
          lancamento.contaPrevista && (
            <div className="flex justify-between"><span className="text-muted-foreground">Conta Prevista</span><span className="font-medium">{lancamento.contaPrevista.nome}</span></div>
          )
        )}
        {lancamento.observacao && (
          <div className="pt-1 text-muted-foreground">Obs.: {lancamento.observacao}</div>
        )}
      </div>

      {lancamento.dadosCheque && (
        <div className="space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
          <h2 className="mb-1 text-base font-semibold">Dados do Cheque</h2>
          <div className="flex justify-between"><span className="text-muted-foreground">Banco</span><span className="font-medium">{lancamento.dadosCheque.banco ?? "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Agência</span><span className="font-medium">{lancamento.dadosCheque.agencia ?? "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Número do Cheque</span><span className="font-medium">{lancamento.dadosCheque.numeroCheque ?? "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Conta Corrente</span><span className="font-medium">{lancamento.dadosCheque.contaCorrente ?? "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">CGC</span><span className="font-medium">{lancamento.dadosCheque.cgc ?? "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">CPF</span><span className="font-medium">{lancamento.dadosCheque.cpf ?? "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Telefone</span><span className="font-medium">{lancamento.dadosCheque.telefone ?? "-"}</span></div>
          {lancamento.dadosCheque.terceiro && (
            <div className="flex justify-between"><span className="text-muted-foreground">Terceiro</span><span className="font-medium">{lancamento.dadosCheque.terceiro}</span></div>
          )}
        </div>
      )}

      {lancamento.dadosCartao && (
        <div className="space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
          <h2 className="mb-1 text-base font-semibold">Dados do Cartão</h2>
          <div className="flex justify-between"><span className="text-muted-foreground">Operadora</span><span className="font-medium">{lancamento.dadosCartao.operadora?.descricao ?? "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Número do Cartão</span><span className="font-medium">{lancamento.dadosCartao.numeroCartao ?? "-"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Número de Autorização</span><span className="font-medium">{lancamento.dadosCartao.numeroAutorizacao ?? "-"}</span></div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo de Taxa</span>
            <span className="font-medium">
              {lancamento.dadosCartao.tipoTaxa ? (TIPOS_TAXA_CARTAO_LABEL[lancamento.dadosCartao.tipoTaxa] ?? lancamento.dadosCartao.tipoTaxa) : "-"}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-1 rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Incluído por</span>
          <span className="font-medium text-foreground">{lancamento.criadoPor?.nome ?? "-"} · {formatarDataHora(lancamento.criadoEm)}</span>
        </div>
        {lancamento.atualizadoPorId && (
          <div className="flex justify-between">
            <span>Última alteração por</span>
            <span className="font-medium text-foreground">
              {lancamento.atualizadoPor?.nome ?? "-"} · {lancamento.atualizadoEm ? formatarDataHora(lancamento.atualizadoEm) : "-"}
            </span>
          </div>
        )}
      </div>

      {lancamento.rateios.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Rateio — Plano Financeiro</h2>
          <ul className="space-y-2">
            {lancamento.rateios.map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                <div className="flex justify-between">
                  <span>{r.plano.codigo} — {r.plano.descricao}</span>
                  <span className="font-medium">{r.percentual.toString()}% · {formatarMoeda(r.valor)}</span>
                </div>
                {r.rateiosCentroCusto.length > 0 && (
                  <ul className="mt-2 space-y-1 border-l border-border pl-3 text-xs text-muted-foreground">
                    {r.rateiosCentroCusto.map((cc) => (
                      <li key={cc.id} className="flex justify-between">
                        <span>{cc.centroCusto.codigo} — {cc.centroCusto.descricao}</span>
                        <span>{cc.percentual.toString()}% · {formatarMoeda(cc.valor)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {lancamento.rateiosProcesso.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Rateio — Processo</h2>
          <ul className="space-y-2">
            {lancamento.rateiosProcesso.map((r) => (
              <li key={r.id} className="flex justify-between rounded-lg border border-border bg-card p-3 text-sm">
                <span>{r.processoItem.codigo} — {r.processoItem.descricao}</span>
                <span className="font-medium">{r.percentual.toString()}% · {formatarMoeda(r.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lancamento.retencoes.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Retenções</h2>
          <ul className="space-y-2">
            {lancamento.retencoes.map((r) => (
              <li key={r.id} className="flex justify-between rounded-lg border border-border bg-card p-3 text-sm">
                <span>{r.plano.codigo} — {r.plano.descricao}</span>
                <span className="font-medium">{r.percentual.toString()}% · {formatarMoeda(r.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lancamento.comissoes.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Comissões</h2>
          <ul className="space-y-2">
            {lancamento.comissoes.map((c) => (
              <li key={c.id} className="flex justify-between rounded-lg border border-border bg-card p-3 text-sm">
                <span>{c.vendedor.nome}</span>
                <span className="font-medium">{c.percentual.toString()}% · {formatarMoeda(c.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lancamento.baixas.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Baixas</h2>
          <ul className="space-y-2">
            {lancamento.baixas.map((b) => (
              <li key={b.id} className="space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{b.conta.nome}</span>
                  <Badge variant={b.estornada ? "secondary" : "default"}>{b.estornada ? "Estornada" : "Ativa"}</Badge>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span className="font-medium">{formatarData(b.dataBaixa)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Juros</span><span className="font-medium">{formatarMoeda(b.juros)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Multa</span><span className="font-medium">{formatarMoeda(b.multa)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span className="font-medium">{formatarMoeda(b.desconto)}</span></div>
                {Number(b.retencoes) > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Retenções</span><span className="font-medium">− {formatarMoeda(b.retencoes)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Valor baixado</span><span className="font-medium">{formatarMoeda(b.valorBaixado)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Usuário</span><span className="font-medium">{b.usuario?.nome ?? "-"}</span></div>
                {(b.adiantamentoCliente || b.adiantamentoFornecedor) && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Adiantamento de</span><span className="font-medium">{(b.adiantamentoCliente ?? b.adiantamentoFornecedor)!.nome}</span></div>
                )}

                {b.estorno && (
                  <div className="mt-2 space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
                    <div className="flex justify-between"><span>Estornado em</span><span>{formatarData(b.estorno.dataEstorno)}</span></div>
                    <div className="flex justify-between"><span>Conta do estorno</span><span>{b.estorno.conta.nome}</span></div>
                    <div>Motivo: {b.estorno.motivo}</div>
                  </div>
                )}

                {b.chequesUtilizados.length > 0 && (
                  <div className="mt-2 space-y-2 border-t border-border pt-2 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">Pago com cheque(s) de terceiro:</div>
                    {b.chequesUtilizados.map((c) => {
                      const chequeLancamento = c.baixaCheque.lancamento;
                      return (
                        <div key={c.id} className="space-y-0.5">
                          <div className="flex justify-between">
                            <span>{chequeLancamento.cliente?.nome ?? chequeLancamento.historicoSimplificado}</span>
                            <span className="font-medium text-foreground">{formatarMoeda(c.baixaCheque.valorBaixado)}</span>
                          </div>
                          {chequeLancamento.dadosCheque && (
                            <div>
                              {[
                                chequeLancamento.dadosCheque.numeroCheque && `Nº ${chequeLancamento.dadosCheque.numeroCheque}`,
                                chequeLancamento.dadosCheque.banco,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {b.utilizadoComoChequeEm && (
                  <div className="mt-2 space-y-0.5 border-t border-border pt-2 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">
                      Repassado pra pagar: {b.utilizadoComoChequeEm.baixaDespesa.lancamento.historicoSimplificado}
                    </div>
                    {b.utilizadoComoChequeEm.baixaDespesa.lancamento.fornecedor && (
                      <div>Fornecedor: {b.utilizadoComoChequeEm.baixaDespesa.lancamento.fornecedor.nome}</div>
                    )}
                    {b.utilizadoComoChequeEm.baixaDespesa.lancamento.documento && (
                      <div>Documento: {b.utilizadoComoChequeEm.baixaDespesa.lancamento.documento}</div>
                    )}
                    <div>Valor: {formatarMoeda(b.utilizadoComoChequeEm.baixaDespesa.valorBaixado)}</div>
                  </div>
                )}

                {!b.estornada && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" variant="outline" render={<Link href={`/lancamentos-financeiros/${id}/estorno`} />}>
                      Estornar Baixa
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mostrarAcoes && (
        <div className="flex flex-wrap gap-2">
          {podeEditar && (
            <Button size="sm" variant="outline" render={<Link href={`/lancamentos-financeiros/${id}/editar`} />}>
              Editar
            </Button>
          )}
          {podeExcluir && <ExcluirLancamentoButton action={excluirLancamentoFinanceiro.bind(null, id)} />}
          {podeConfirmarPrevisao && <ConfirmarPrevisaoButton action={confirmarPrevisao.bind(null, id)} />}
          {podeDarBaixa && (
            <Button size="sm" render={<Link href={`/lancamentos-financeiros/${id}/baixa`} />}>
              Dar Baixa
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
