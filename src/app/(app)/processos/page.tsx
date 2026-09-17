import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ProcessosLista, type ItemProcesso } from "@/components/processos-lista";

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function ProcessosPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const processos = await db.processo.findMany({
    where: { empresaId: session.user.empresaId! },
    orderBy: { dataInicio: "desc" },
  });

  const itens: ItemProcesso[] = processos.map((p) => ({
    id: p.id,
    nome: p.nome,
    periodo: `${formatarData(p.dataInicio)} – ${formatarData(p.dataFim)}`,
    padrao: p.padrao,
    ativo: p.ativo,
    buscaTexto: p.nome.toLowerCase(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Processos</h1>
        <Button render={<Link href="/processos/novo" />}>Novo Processo</Button>
      </div>

      <Link href="/processos/mascaras" className="text-sm font-medium text-primary">
        Configurar máscaras
      </Link>

      <ProcessosLista itens={itens} />
    </div>
  );
}
