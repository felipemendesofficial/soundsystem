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
    db.usuario.findFirst({
      where: { id, grupoId: session.user.grupoId! },
      include: { empresasAcesso: { where: { empresaId: session.user.empresaId! } } },
    }),
    db.deposito.findMany({
      where: { ativo: true, empresaId: session.user.empresaId! },
      orderBy: { nome: "asc" },
    }),
  ]);
  if (!usuario) notFound();

  const defaultValues = {
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    depositoPadraoId: usuario.empresasAcesso[0]?.depositoPadraoId ?? null,
    ativo: usuario.ativo,
  };

  const action = atualizarUsuario.bind(null, id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Editar Usuário</h1>
      <UsuarioForm action={action} depositos={depositos} defaultValues={defaultValues} ehEdicao />
    </div>
  );
}
