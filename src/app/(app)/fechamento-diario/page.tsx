import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { obterUltimoFechamentoAtivo, obterDataInicioControle, calcularProximoDiaAFechar, hojeUTC } from "@/lib/financeiro-ledger";
import { FecharDiaBotao, ReabrirDiaBotao } from "./fechamento-botoes";

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function FechamentoDiarioPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const [ultimoFechamento, dataInicioControle] = await Promise.all([
    obterUltimoFechamentoAtivo(db, empresaId),
    obterDataInicioControle(db, empresaId),
  ]);
  const proximoDia = calcularProximoDiaAFechar(ultimoFechamento, dataInicioControle);
  const haAlgoPraFechar = proximoDia.getTime() <= hojeUTC().getTime();

  const historico = await db.fechamentoDiario.findMany({
    where: { empresaId },
    orderBy: { data: "desc" },
    take: 30,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Fechamento Diário</h1>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        {ultimoFechamento ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] text-muted-foreground">Último fechamento ativo</div>
              <div className="text-[15px] font-semibold">{formatarData(ultimoFechamento.data)}</div>
            </div>
            <ReabrirDiaBotao />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {dataInicioControle
              ? `Nenhum fechamento ainda — controle configurado pra começar em ${formatarData(dataInicioControle)}.`
              : "Nenhum fechamento ainda."}
          </p>
        )}

        {haAlgoPraFechar ? (
          <FecharDiaBotao label={`Fechar dia ${formatarData(proximoDia)}`} />
        ) : (
          <p className="text-sm text-muted-foreground">O dia de hoje já está fechado.</p>
        )}
      </div>

      {!ultimoFechamento && !dataInicioControle && (
        <p className="text-xs text-muted-foreground">
          Vai lançar retroativo? Configure a{" "}
          <Link href="/parametros-financeiros" className="font-medium text-primary underline">
            data de início do controle financeiro
          </Link>{" "}
          antes de começar a fechar dias.
        </p>
      )}

      <div className="space-y-2">
        <h2 className="text-base font-semibold">Histórico</h2>
        {historico.length === 0 ? (
          <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum fechamento registrado.
          </p>
        ) : (
          <ul className="space-y-2">
            {historico.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
                <span className="font-medium">{formatarData(f.data)}</span>
                <Badge variant={f.ativo ? "default" : "secondary"}>{f.ativo ? "Fechado" : "Reaberto"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
