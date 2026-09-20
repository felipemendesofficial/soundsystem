import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeLancarMovimentacao } from "@/lib/permissions";
import { atualizarOrdemProducao } from "../../actions";
import { OrdemProducaoForm, type OrdemProducaoDefaultValues } from "../../ordem-producao-form";

export default async function EditarOrdemProducaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeLancarMovimentacao(session.user.perfil)) redirect("/");
  const grupoId = session.user.grupoId!;
  const empresaId = session.user.empresaId!;

  const [ordem, depositos, produtos, servicos] = await Promise.all([
    db.ordemProducao.findFirst({
      where: { id, empresaId },
      include: {
        produtoFinal: true,
        materiais: { include: { produto: true } },
        servicos: { include: { servico: true } },
      },
    }),
    db.deposito.findMany({ where: { empresaId, ativo: true }, orderBy: { nome: "asc" } }),
    db.produto.findMany({ where: { grupoId, ativo: true }, orderBy: { nome: "asc" } }),
    db.servico.findMany({ where: { grupoId, ativo: true }, orderBy: { nome: "asc" } }),
  ]);
  if (!ordem) notFound();
  if (ordem.status !== "aberta") redirect(`/ordens-producao/${id}`);

  const defaultValues: OrdemProducaoDefaultValues = {
    depositoEntradaId: ordem.depositoEntradaId,
    produtoFinal: { id: ordem.produtoFinal.id, label: `${ordem.produtoFinal.nome} — ${ordem.produtoFinal.sku}` },
    quantidadeEntrada: ordem.quantidadeEntrada.toString(),
    materiais: ordem.materiais.map((m) => ({
      produto: { id: m.produto.id, label: `${m.produto.nome} — ${m.produto.sku}` },
      depositoId: m.depositoId,
      quantidade: m.quantidade.toString(),
    })),
    servicos: ordem.servicos.map((s) => ({ servico: { id: s.servico.id, label: s.servico.nome }, valor: s.valor.toString() })),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar OP {ordem.numero}</h1>
      <OrdemProducaoForm
        action={atualizarOrdemProducao.bind(null, id)}
        depositos={depositos.map((d) => ({ id: d.id, label: d.nome }))}
        produtos={produtos.map((p) => ({ id: p.id, label: `${p.nome} — ${p.sku}` }))}
        servicos={servicos.map((s) => ({ id: s.id, label: s.nome }))}
        defaultValues={defaultValues}
      />
    </div>
  );
}
