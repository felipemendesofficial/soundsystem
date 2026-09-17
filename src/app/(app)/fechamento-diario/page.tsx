import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { obterUltimoFechamentoAtivo, calcularProximoDiaAFechar } from "@/lib/financeiro-ledger";
import { FecharDiaBotao, ReabrirDiaBotao } from "./fechamento-botoes";

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function FechamentoDiarioPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");
  const empresaId = session.user.empresaId!;

  const ultimoFechamento = await obterUltimoFechamentoAtivo(db, empresaId);
  const proximoDia = calcularProximoDiaAFechar(ultimoFechamento);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const haAlgoPraFechar = proximoDia.getTime() <= hoje.getTime();

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
          <p className="text-sm text-muted-foreground">Nenhum fechamento ainda.</p>
        )}

        {haAlgoPraFechar ? (
          <FecharDiaBotao label={`Fechar dia ${formatarData(proximoDia)}`} />
        ) : (
          <p className="text-sm text-muted-foreground">O dia de hoje já está fechado.</p>
        )}
      </div>

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
