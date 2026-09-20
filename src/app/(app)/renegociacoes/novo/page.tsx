import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { chaveAgrupamentoTerceiro } from "@/lib/cnpj";
import { criarRenegociacao } from "../actions";
import { RenegociacaoForm } from "../renegociacao-form";

export default async function NovaRenegociacaoPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const grupoId = session.user.grupoId!;
  const empresaId = session.user.empresaId!;

  const [clientesRaw, fornecedoresRaw, processos, processoItens, abertos, creditos] = await Promise.all([
    db.cliente.findMany({ where: { grupoId }, orderBy: { nome: "asc" } }),
    db.fornecedor.findMany({ where: { grupoId }, orderBy: { nome: "asc" } }),
    db.processo.findMany({ where: { empresaId, ativo: true }, orderBy: { nome: "asc" } }),
    db.processoItem.findMany({
      where: { processo: { empresaId }, natureza: "analitica", ativo: true },
      orderBy: { codigo: "asc" },
    }),
    db.lancamentoFinanceiro.findMany({
      where: { empresaId, status: "aberto", renegociacoesOrigem: { none: { renegociacao: { status: "aberta" } } } },
      include: { cliente: true, fornecedor: true },
      orderBy: { dataVencimento: "asc" },
    }),
    db.creditoDevolucao.findMany({
      where: { empresaId, saldoDisponivel: { gt: 0 } },
      include: { cliente: true, fornecedor: true, usos: { where: { renegociacao: { status: "aberta" } } } },
    }),
  ]);

  const clientes = clientesRaw.map((c) => ({ id: c.id, label: c.nome, grupoChave: chaveAgrupamentoTerceiro(c.id, c.documento) }));
  const fornecedores = fornecedoresRaw.map((f) => ({ id: f.id, label: f.nome, grupoChave: chaveAgrupamentoTerceiro(f.id, f.documento) }));

  const origensDisponiveis = abertos.map((l) => {
    const terceiro = l.cliente ?? l.fornecedor;
    return {
      id: l.id,
      tipo: l.tipo,
      label: `${l.historicoSimplificado} — ${terceiro?.nome ?? ""}`,
      valor: Number(l.valorOriginal),
      vencimento: l.dataVencimento.toISOString().slice(0, 10),
      grupoChave: terceiro ? chaveAgrupamentoTerceiro(terceiro.id, terceiro.documento ?? null) : "",
      contraparteId: terceiro?.id ?? "",
      contraparteLabel: terceiro?.nome ?? "",
    };
  });

  const processoPadrao = processos.find((p) => p.padrao) ?? (processos.length === 1 ? processos[0] : undefined);

  const creditosDisponiveis = creditos
    .map((c) => {
      const terceiro = c.cliente ?? c.fornecedor;
      const reservadoPorRascunhos = c.usos.reduce((acc, u) => acc + Number(u.valorUtilizado), 0);
      return {
        id: c.id,
        label: `${terceiro?.nome ?? ""} — crédito de devolução`,
        saldoDisponivel: Number(c.saldoDisponivel) - reservadoPorRascunhos,
        grupoChave: terceiro ? chaveAgrupamentoTerceiro(terceiro.id, terceiro.documento ?? null) : "",
        isCliente: !!c.clienteId,
      };
    })
    .filter((c) => c.saldoDisponivel > 0.004);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nova Renegociação</h1>
      <RenegociacaoForm
        action={criarRenegociacao}
        origensDisponiveis={origensDisponiveis}
        clientes={clientes}
        fornecedores={fornecedores}
        creditosDisponiveis={creditosDisponiveis}
        processos={processos.map((p) => ({ id: p.id, label: p.nome, grupoChave: "" }))}
        processoPadraoId={processoPadrao?.id}
        processoItens={processoItens.map((i) => ({ id: i.id, label: `${i.codigo} — ${i.descricao}`, processoId: i.processoId }))}
      />
    </div>
  );
}
