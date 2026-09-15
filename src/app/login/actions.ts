"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";

export type LoginState = {
  erro?: string;
};

export async function autenticar(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");

  try {
    await signIn("credentials", {
      email,
      senha: formData.get("senha"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { erro: "Email ou senha inválidos." };
    }
    throw error;
  }

  // Evita servir um payload de rota cacheado de antes do login (ex.: "/"
  // ainda mostrando a tela de login) — mesmo problema já corrigido em
  // selecionarEmpresa.
  revalidatePath("/", "layout");

  // Busca o perfil direto no banco em vez de reler a sessão recém-criada:
  // logo após `signIn`, o cookie de sessão pode ainda não estar visível pra
  // leitura na mesma requisição, fazendo `auth()` devolver undefined e
  // mandando até o master pra "/" por engano.
  const usuario = await db.usuario.findUnique({ where: { email }, select: { perfil: true } });
  redirect(usuario?.perfil === "master" ? "/admin" : "/");
}
