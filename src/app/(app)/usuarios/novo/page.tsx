import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarUsuarios } from "@/lib/permissions";
import { criarUsuario } from "../actions";
import { UsuarioForm } from "../usuario-form";

export default async function NovoUsuarioPage() {
  const session = await auth();
  if (!session?.user || !podeGerenciarUsuarios(session.user.perfil)) redirect("/");

  const depositos = await db.deposito.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Novo Usuário</h1>
      <UsuarioForm action={criarUsuario} depositos={depositos} />
    </div>
  );
}
