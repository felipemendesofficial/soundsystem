import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstornarMovimentoAplicacaoButton } from "@/components/estornar-movimento-aplicacao-button";
import { estornarMovimentoAplicacao } from "./actions";

const TIPOS_LABEL: Record<string, string> = {
  aplicacao_financeira: "Aplicação",
  resgate_aplicacao: "Resgate",
  registro_rendimento: "Rendimento",
};

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function AplicacoesFinanceirasPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const movimentos = await db.movimentoAplicacao.findMany({
    where: { empresaId: session.user.empresaId! },
    include: { daConta: true, paraConta: true },
    orderBy: { dataMovimento: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Aplicações Financeiras</h1>
        <Button render={<Link href="/aplicacoes-financeiras/novo" />}>Nova</Button>
      </div>

      {movimentos.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum movimento de aplicação registrado.
        </p>
      ) : (
        <ul className="space-y-2">
          {movimentos.map((m) => (
            <li key={m.id} className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{TIPOS_LABEL[m.tipoMovimento] ?? m.tipoMovimento}</span>
                <Badge variant={m.estornado ? "secondary" : "default"}>{m.estornado ? "Estornado" : "Ativo"}</Badge>
              </div>
              <div className="text-muted-foreground">
                {m.daConta ? `${m.daConta.nome} → ` : ""}{m.paraConta.nome}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{formatarData(m.dataMovimento)}</span>
                <span className="font-medium">{formatarMoeda(m.valor)}</span>
              </div>
              {!m.estornado && !m.estornoDeId && (
                <div className="pt-1">
                  <EstornarMovimentoAplicacaoButton action={estornarMovimentoAplicacao.bind(null, m.id)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
