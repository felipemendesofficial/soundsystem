import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { calcularProximaOcorrenciaRecorrente } from "@/lib/lancamento-recorrente";
import { hojeUTC } from "@/lib/financeiro-ledger";
import { GerarPendentesLista, type ItemPendente } from "../gerar-pendentes-lista";

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function GerarPendentesPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const recorrentes = await db.lancamentoFinanceiroRecorrente.findMany({
    where: { empresaId, ativo: true },
    orderBy: { descricao: "asc" },
  });

  const hoje = hojeUTC();
  const itens: ItemPendente[] = [];

  for (const recorrente of recorrentes) {
    const ultimoGerado = await db.lancamentoFinanceiro.findFirst({
      where: { recorrenteId: recorrente.id },
      orderBy: { dataVencimento: "desc" },
    });
    const proxima = calcularProximaOcorrenciaRecorrente(recorrente, ultimoGerado?.dataVencimento ?? null);
    if (proxima && proxima.getTime() <= hoje.getTime()) {
      itens.push({
        recorrenteId: recorrente.id,
        descricao: recorrente.descricao,
        proximaOcorrencia: formatarData(proxima),
        valorSugerido: ultimoGerado ? ultimoGerado.valorOriginal.toString() : null,
      });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Gerar Pendentes</h1>
      <p className="text-sm text-muted-foreground">
        Recorrentes ativos cuja próxima ocorrência já chegou. O valor vem sugerido da última geração — sempre editável.
      </p>
      <GerarPendentesLista itens={itens} />
    </div>
  );
}
