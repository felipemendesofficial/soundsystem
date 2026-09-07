import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarUsuarios } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { UsuariosLista, type ItemUsuario } from "@/components/usuarios-lista";

const PERFIL_LABEL: Record<string, string> = {
  admin: "Administrador",
  estoquista: "Estoquista",
  vendedor: "Vendedor",
};

export default async function UsuariosPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarUsuarios(session.user.perfil)) redirect("/");

  const usuarios = await db.usuario.findMany({
    orderBy: { nome: "asc" },
    include: { depositoPadrao: true },
  });

  const itensLista: ItemUsuario[] = usuarios.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: PERFIL_LABEL[u.perfil],
    depositoPadrao: u.depositoPadrao?.nome ?? "-",
    ativo: u.ativo,
    buscaTexto: [u.nome, u.email].join(" ").toLowerCase(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <Button render={<Link href="/usuarios/novo" />}>Novo Usuário</Button>
      </div>

      <UsuariosLista itens={itensLista} />
    </div>
  );
}
