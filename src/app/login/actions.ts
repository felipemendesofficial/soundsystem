"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signIn, auth } from "@/lib/auth";

export type LoginState = {
  erro?: string;
};

export async function autenticar(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      senha: formData.get("senha"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { erro: "Email ou senha inválidos." };
    }
    throw error;
  }

  const session = await auth();
  // Evita servir um payload de rota cacheado de antes do login (ex.: "/"
  // ainda mostrando a tela de login) — mesmo problema já corrigido em
  // selecionarEmpresa.
  revalidatePath("/", "layout");
  redirect(session?.user.perfil === "master" ? "/admin" : "/");
}
