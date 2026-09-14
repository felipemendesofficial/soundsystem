"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth, unstable_update } from "@/lib/auth";
import { db } from "@/lib/db";

export async function selecionarEmpresa(empresaId: string) {
  const session = await auth();
  if (!session?.user || session.user.perfil === "master") {
    throw new Error("Não permitido.");
  }

  const acesso = await db.usuarioEmpresa.findUnique({
    where: { usuarioId_empresaId: { usuarioId: session.user.id, empresaId } },
  });
  if (!acesso) throw new Error("Sem acesso a essa empresa.");

  await unstable_update({ user: { empresaId, depositoPadraoId: acesso.depositoPadraoId } });
  // Troca de empresa muda o resultado de toda página do app — sem isso o
  // router cache do Next.js reaproveita dados da empresa anterior nas rotas
  // já visitadas nesta sessão.
  revalidatePath("/", "layout");
  redirect("/");
}
