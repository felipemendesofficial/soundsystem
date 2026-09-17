import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { atualizarContaFinanceira, alternarAtivoContaFinanceira } from "../actions";
import { ContaFinanceiraForm } from "../conta-financeira-form";

function formatarMoeda(valor: unknown) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function EditarContaFinanceiraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const conta = await db.contaFinanceira.findFirst({ where: { id, empresaId: session.user.empresaId! } });
  if (!conta) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Editar Conta Financeira</h1>
        <Badge variant={conta.ativo ? "default" : "secondary"}>
          {conta.ativo ? "Ativa" : "Inativa"}
        </Badge>
      </div>

      <ContaFinanceiraForm
        action={atualizarContaFinanceira.bind(null, id)}
        defaultValues={{
          tipo: conta.tipo,
          nome: conta.nome,
          numeroConta: conta.numeroConta,
          agencia: conta.agencia,
          banco: conta.banco,
          limiteCredito: conta.limiteCredito ? Number(conta.limiteCredito) : null,
          dataAbertura: conta.dataAbertura ? conta.dataAbertura.toISOString().slice(0, 10) : null,
          valorFundoFixo: conta.valorFundoFixo ? Number(conta.valorFundoFixo) : null,
          saldoInicial: Number(conta.saldoInicial),
          saldoAtual: formatarMoeda(conta.saldoAtual),
          gerarBoleto: conta.gerarBoleto,
          adiantamentoCliente: conta.adiantamentoCliente,
          adiantamentoFornecedor: conta.adiantamentoFornecedor,
        }}
      />

      <form action={alternarAtivoContaFinanceira.bind(null, id, !conta.ativo)}>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className={conta.ativo ? "border-destructive text-destructive hover:bg-destructive/10" : ""}
        >
          {conta.ativo ? "Desativar" : "Ativar"}
        </Button>
      </form>
    </div>
  );
}
