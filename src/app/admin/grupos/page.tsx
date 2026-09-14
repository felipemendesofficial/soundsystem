import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { GruposLista, type ItemGrupo } from "@/components/grupos-lista";

// Única tela do sistema com visão cross-grupo — deliberado: é o papel do
// usuário master (perfil de plataforma, sem grupo) gerenciar o cadastro de
// Grupos/Empresas em si, nunca os dados de negócio de cada um.
export default async function AdminGruposPage() {
  const grupos = await db.grupoEmpresarial.findMany({
    orderBy: { nome: "asc" },
    include: { empresas: { orderBy: { nome: "asc" } } },
  });

  const itensLista: ItemGrupo[] = grupos.map((g) => ({
    id: g.id,
    nome: g.nome,
    empresas: g.empresas.map((e) => ({ nome: e.nome, cnpj: e.cnpj })),
    ativo: g.ativo,
    buscaTexto: [g.nome, ...g.empresas.map((e) => e.nome)].join(" ").toLowerCase(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Grupos</h1>
        <Button render={<Link href="/admin/grupos/novo" />}>Novo Grupo</Button>
      </div>

      <GruposLista itens={itensLista} />
    </div>
  );
}
