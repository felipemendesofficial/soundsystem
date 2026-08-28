import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarUsuarios } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <Button render={<Link href="/usuarios/novo" />}>Novo Usuário</Button>
      </div>

      <DataTable
        rows={usuarios}
        getKey={(u) => u.id}
        columns={[
          { header: "Nome", cell: (u) => u.nome },
          { header: "Email", cell: (u) => u.email },
          { header: "Perfil", cell: (u) => <Badge variant="secondary">{PERFIL_LABEL[u.perfil]}</Badge> },
          { header: "Depósito padrão", cell: (u) => u.depositoPadrao?.nome ?? "-" },
          {
            header: "Status",
            cell: (u) => (
              <Badge variant={u.ativo ? "default" : "secondary"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
            ),
          },
          {
            header: "",
            cell: (u) => (
              <Link href={`/usuarios/${u.id}`} className="text-sm underline underline-offset-2">
                Editar
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
