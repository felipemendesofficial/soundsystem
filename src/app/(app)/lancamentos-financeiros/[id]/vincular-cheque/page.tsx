import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { vincularChequeTerceiro } from "./actions";
import { VincularChequeForm } from "./vincular-cheque-form";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function VincularChequePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const lancamento = await db.lancamentoFinanceiro.findFirst({ where: { id, empresaId } });
  if (!lancamento) notFound();
  if (lancamento.tipo !== "despesa") redirect(`/lancamentos-financeiros/${id}`);

  const chequesDisponiveis = await db.baixa.findMany({
    where: {
      estornada: false,
      lancamento: { empresaId, tipo: "receita", tipoDocumento: { in: ["cheque_vista", "cheque_prazo"] } },
      utilizadoComoChequeEm: null,
    },
    include: { lancamento: true },
    orderBy: { dataBaixa: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Pagar com Cheque de Terceiro</h1>
      <p className="text-sm text-muted-foreground">{lancamento.historicoSimplificado}</p>

      {chequesDisponiveis.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum cheque de terceiro disponível (recebido numa Receita, ainda não repassado).
        </p>
      ) : (
        <VincularChequeForm
          action={vincularChequeTerceiro.bind(null, id)}
          cancelarHref={`/lancamentos-financeiros/${id}`}
          cheques={chequesDisponiveis.map((b) => ({
            id: b.id,
            label: `${b.lancamento.historicoSimplificado} · ${formatarData(b.dataBaixa)} · ${formatarMoeda(b.valorBaixado)}`,
          }))}
        />
      )}
    </div>
  );
}
