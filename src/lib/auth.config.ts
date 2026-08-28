import type { NextAuthConfig } from "next-auth";
import type { Perfil } from "@/generated/prisma/client";

declare module "next-auth" {
  interface User {
    perfil?: Perfil;
    depositoPadraoId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      perfil: Perfil;
      depositoPadraoId: string | null;
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
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.perfil = user.perfil as Perfil;
        token.depositoPadraoId = user.depositoPadraoId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.perfil = token.perfil as Perfil;
      session.user.depositoPadraoId = token.depositoPadraoId as string | null;
      return session;
    },
  },
} satisfies NextAuthConfig;
