"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { podeGerenciarVendedor } from "@/lib/permissions";
import { normalizarTexto } from "@/lib/texto";

export type VendedorFormState = { erro?: string };

const schema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").transform(normalizarTexto),
  ativo: z.enum(["on"]).nullish(),
  recebeComissao: z.enum(["on"]).nullish(),
  tipoComissao: z.union([z.literal(""), z.enum(["percentual", "fixa"])]).optional(),
  valorComissao: z.coerce.number().nonnegative("Valor da comissão não pode ser negativo.").optional(),
});

async function exigirPermissao() {
  const session = await auth();
  if (!session?.user) return { erro: "Não autenticado." } as const;
  if (!podeGerenciarVendedor(session.user.perfil)) {
    return { erro: "Seu perfil não pode gerenciar Vendedores." } as const;
  }
  return { session } as const;
}

function toData(formData: FormData) {
  return schema.safeParse({
    nome: formData.get("nome"),
    ativo: formData.get("ativo"),
    recebeComissao: formData.get("recebeComissao"),
    tipoComissao: formData.get("tipoComissao"),
    valorComissao: formData.get("valorComissao") || undefined,
  });
}

function montarDados(parsed: z.infer<typeof schema>) {
  const recebeComissao = parsed.recebeComissao === "on";
  return {
    valido: !recebeComissao || (!!parsed.tipoComissao && parsed.valorComissao !== undefined && parsed.valorComissao > 0),
    data: {
      nome: parsed.nome,
      ativo: parsed.ativo === "on",
      recebeComissao,
      tipoComissao: recebeComissao ? (parsed.tipoComissao as "percentual" | "fixa") : null,
      valorComissao: recebeComissao ? parsed.valorComissao : null,
    },
  };
}

export async function criarVendedor(_prev: VendedorFormState, formData: FormData): Promise<VendedorFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const { valido, data } = montarDados(parsed.data);
  if (!valido) return { erro: "Selecione o tipo e informe o valor da comissão." };

  await db.vendedor.create({ data });

  revalidatePath("/vendedores");
  redirect("/vendedores");
}

export async function atualizarVendedor(
  id: string,
  _prev: VendedorFormState,
  formData: FormData
): Promise<VendedorFormState> {
  const permissao = await exigirPermissao();
  if ("erro" in permissao) return permissao;

  const parsed = toData(formData);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const { valido, data } = montarDados(parsed.data);
  if (!valido) return { erro: "Selecione o tipo e informe o valor da comissão." };

  await db.vendedor.update({ where: { id }, data });

  revalidatePath("/vendedores");
  redirect("/vendedores");
}
