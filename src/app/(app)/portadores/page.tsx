import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarFinanceiro } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { PortadoresLista, type ItemPortador } from "@/components/portadores-lista";

export default async function PortadoresPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarFinanceiro(session.user.perfil)) redirect("/");

  const portadores = await db.portador.findMany({
    where: { empresaId: session.user.empresaId! },
    orderBy: { nome: "asc" },
  });

  const itensLista: ItemPortador[] = portadores.map((p) => ({
    id: p.id,
    nome: p.nome,
    ativo: p.ativo,
    buscaTexto: p.nome.toLowerCase(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Portadores</h1>
        <Button render={<Link href="/portadores/novo" />}>Novo Portador</Button>
      </div>

      <PortadoresLista itens={itensLista} />
    </div>
  );
}
