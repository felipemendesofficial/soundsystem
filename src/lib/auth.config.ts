import type { NextAuthConfig } from "next-auth";
import type { Perfil } from "@/generated/prisma/client";

declare module "next-auth" {
  interface User {
    perfil?: Perfil;
    grupoId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      perfil: Perfil;
      grupoId: string | null; // null somente para perfil = master
      empresaId: string | null; // null até escolher no /selecionar-empresa (ou sempre null pra master)
      depositoPadraoId: string | null; // por (usuário, empresa) — ver UsuarioEmpresa
    };
  }
}

/**
 * Config sem providers (não puxa Prisma/bcrypt para o bundle). Usado tanto
 * pelo proxy/middleware (Edge Runtime) quanto por auth.ts, que adiciona o
 * Credentials provider por cima disso.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  // Necessário atrás de proxy reverso (Traefik) — sem isso o Auth.js rejeita
  // o Host header encaminhado com "UntrustedHost". Traefik é o único ingress
  // (portas 80/443 não são acessíveis diretamente), então é seguro confiar nele.
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.perfil = user.perfil as Perfil;
        token.grupoId = user.grupoId ?? null;
        token.empresaId = null;
        token.depositoPadraoId = null;
      }
      // Disparado por `unstable_update` (ver src/app/selecionar-empresa/actions.ts) —
      // é assim que a empresa ativa entra na sessão depois do login inicial.
      if (trigger === "update" && session?.user) {
        if ("empresaId" in session.user) token.empresaId = session.user.empresaId;
        if ("depositoPadraoId" in session.user) token.depositoPadraoId = session.user.depositoPadraoId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.perfil = token.perfil as Perfil;
      session.user.grupoId = token.grupoId as string | null;
      session.user.empresaId = token.empresaId as string | null;
      session.user.depositoPadraoId = token.depositoPadraoId as string | null;
      return session;
    },
  },
} satisfies NextAuthConfig;
