import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarUsuarios } from "@/lib/permissions";
import { atualizarUsuario } from "../actions";
import { UsuarioForm } from "../usuario-form";

export default async function EditarUsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !podeGerenciarUsuarios(session.user.perfil)) redirect("/");

  const { id } = await params;
  const [usuario, depositos] = await Promise.all([
    db.usuario.findUnique({ where: { id } }),
    db.deposito.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
  ]);
  if (!usuario) notFound();

  const action = atualizarUsuario.bind(null, id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar Usuário</h1>
      <UsuarioForm action={action} depositos={depositos} defaultValues={usuario} ehEdicao />
    </div>
  );
}
