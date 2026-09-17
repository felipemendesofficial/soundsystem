import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { criarProcesso } from "../actions";
import { ProcessoForm } from "../processo-form";

export default async function NovoProcessoPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const mascaras = await db.mascaraProcesso.findMany({
    where: { grupoId: session.user.grupoId! },
    orderBy: { nome: "asc" },
  });

  if (mascaras.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Novo Processo</h1>
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma máscara de Processo cadastrada ainda.{" "}
          <Link href="/processos/mascaras/novo" className="font-medium text-primary">
            Criar a primeira
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo Processo</h1>
      <ProcessoForm action={criarProcesso} cancelarHref="/processos" mascaras={mascaras} />
    </div>
  );
}
