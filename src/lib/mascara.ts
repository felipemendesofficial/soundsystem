import { z } from "zod";
import type { NaturezaConta } from "@/generated/prisma/enums";

/**
 * Separador entre segmentos do código de Plano Financeiro / Centro de Custo /
 * Item de Processo — as 3 famílias de cadastro hierárquico com máscara
 * configurável compartilham esta mesma lógica (ver CLAUDE.md, módulo
 * financeiro). O código nunca é digitado livremente pelo usuário: cada nível
 * contribui só o segmento daquele nível, zero-padded, e o sistema concatena
 * com o prefixo do pai.
 */
export const SEPARADOR_CODIGO = ".";

/**
 * Um nó no último nível da máscara nasce Analítica (folha, usada em rateio);
 * qualquer nível anterior nasce Sintética (agrupador). Automático — sem
 * escolha manual — porque isso também determina se o nó pode ganhar filho:
 * só nós Sintética oferecem a ação "adicionar filho".
 */
export function naturezaParaNivel(nivel: number, totalSegmentos: number): NaturezaConta {
  return nivel >= totalSegmentos ? "analitica" : "sintetica";
}

/**
 * Acha o segmento da máscara correspondente ao nível sendo criado (nível do
 * pai + 1, ou 1 se for raiz). `undefined` significa que a máscara não tem mais
 * níveis — não deveria acontecer já que "adicionar filho" só aparece em nós
 * Sintética, mas o server action valida de novo por segurança.
 */
export function segmentoDoNivel<T extends { ordem: number }>(
  segmentos: T[],
  nivel: number
): T | undefined {
  return segmentos.find((s) => s.ordem === nivel);
}

export class SegmentoInvalidoError extends Error {}

/**
 * Valida que o texto digitado pelo usuário pro nível atual é só dígitos e
 * cabe em `qtdDigitos`, e monta o código final concatenando com o prefixo do
 * pai (ou sem prefixo, se for raiz).
 */
export function montarCodigo(
  codigoPai: string | null,
  segmentoDigitado: string,
  qtdDigitos: number
): string {
  const digitos = segmentoDigitado.trim();
  if (!/^\d+$/.test(digitos)) {
    throw new SegmentoInvalidoError("Informe só números.");
  }
  if (digitos.length > qtdDigitos) {
    throw new SegmentoInvalidoError(`Esse nível aceita no máximo ${qtdDigitos} dígito(s).`);
  }

  const segmentoFormatado = digitos.padStart(qtdDigitos, "0");
  return codigoPai ? `${codigoPai}${SEPARADOR_CODIGO}${segmentoFormatado}` : segmentoFormatado;
}

const segmentoInputSchema = z.object({
  ordem: z.number().int().positive(),
  qtdDigitos: z.number().int().min(1).max(9),
  nome: z.string().trim().optional(),
});

const segmentosInputSchema = z.array(segmentoInputSchema).min(1, "Informe ao menos um nível.");

export type SegmentoInput = z.infer<typeof segmentoInputSchema>;

/**
 * Parseia o hidden input JSON do editor de segmentos (`src/components/mascara-form.tsx`).
 * O client já monta `ordem` como 1..N sequencial, mas o server nunca confia
 * no client — reconfere aqui antes de gravar.
 */
export function parseSegmentosJson(raw: FormDataEntryValue | null): { segmentos: SegmentoInput[] } | { erro: string } {
  if (typeof raw !== "string") return { erro: "Níveis inválidos." };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { erro: "Níveis inválidos." };
  }

  const parsed = segmentosInputSchema.safeParse(json);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Níveis inválidos." };

  const ordensEsperadas = parsed.data.map((_, i) => i + 1);
  const ordensRecebidas = parsed.data.map((s) => s.ordem);
  if (JSON.stringify(ordensRecebidas) !== JSON.stringify(ordensEsperadas)) {
    return { erro: "Níveis fora de ordem." };
  }

  return { segmentos: parsed.data };
}
