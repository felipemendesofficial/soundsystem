import "dotenv/config";
import { db } from "@/lib/db";

const URL_CSV_BACEN = "https://www.bcb.gov.br/content/estabilidadefinanceira/str1/ParticipantesSTR.csv";

/**
 * Parser CSV mínimo (RFC 4180) — o arquivo do Bacen tem campos com vírgula
 * e aspas embutidas (razões sociais como "SANTINVEST S.A. - CREDITO,
 * FINANCIAMENTO E INVESTIMENTOS"), então um split(",") ingênuo quebraria.
 * Sem dependência nova só pra isso.
 */
function parseCsvLine(linha: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroDeAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const char = linha[i];
    if (dentroDeAspas) {
      if (char === '"') {
        if (linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else {
          dentroDeAspas = false;
        }
      } else {
        atual += char;
      }
    } else if (char === '"') {
      dentroDeAspas = true;
    } else if (char === ",") {
      campos.push(atual);
      atual = "";
    } else {
      atual += char;
    }
  }
  campos.push(atual);
  return campos;
}

/**
 * Baixa a lista oficial de participantes do STR (Bacen, Portal de Dados
 * Abertos) e faz upsert por ISPB — nunca por nome (nomes mudam, ISPB é
 * estável). Colunas reais do CSV (confirmado em 2026-09-19, header com
 * acentos): ISPB, Nome_Reduzido, Número_Código, Participa_da_Compe,
 * Acesso_Principal, Nome_Extenso, Início_da_Operação.
 */
async function main() {
  const resposta = await fetch(URL_CSV_BACEN);
  if (!resposta.ok) {
    throw new Error(`Falha ao baixar o CSV do Bacen: HTTP ${resposta.status}`);
  }
  const buffer = await resposta.arrayBuffer();
  // O arquivo vem com BOM UTF-8 — remove antes de parsear o header.
  const texto = new TextDecoder("utf-8").decode(buffer).replace(/^﻿/, "");
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");

  const header = parseCsvLine(linhas[0]);
  const idx = {
    ispb: header.indexOf("ISPB"),
    nomeReduzido: header.indexOf("Nome_Reduzido"),
    codigo: header.indexOf("Número_Código"),
    participaCompe: header.indexOf("Participa_da_Compe"),
    nomeExtenso: header.indexOf("Nome_Extenso"),
  };
  if (Object.values(idx).some((i) => i === -1)) {
    throw new Error(`Cabeçalho do CSV do Bacen mudou — colunas esperadas não encontradas: ${JSON.stringify(idx)}`);
  }

  let criados = 0;
  let atualizados = 0;
  let ignorados = 0;

  for (const linha of linhas.slice(1)) {
    const campos = parseCsvLine(linha);
    const ispb = campos[idx.ispb]?.trim();
    const nome = campos[idx.nomeReduzido]?.trim();
    if (!ispb || !nome) {
      ignorados++;
      continue;
    }
    // "n/a" e "0" são placeholders de "sem código Compe" — ex.: câmaras/
    // sistemas de liquidação da B3 usam "0" repetido, o que violaria o
    // @@unique se tratado como código real.
    const codigoBruto = campos[idx.codigo]?.trim();
    const codigoCompe = codigoBruto && codigoBruto !== "n/a" && codigoBruto !== "0" ? codigoBruto : null;
    const nomeCompleto = campos[idx.nomeExtenso]?.trim() || null;
    const participaCompe = campos[idx.participaCompe]?.trim().toLowerCase() === "sim";

    const existente = await db.banco.findUnique({ where: { ispb } });
    await db.banco.upsert({
      where: { ispb },
      update: { codigoCompe, nome, nomeCompleto, participaCompe },
      create: { ispb, codigoCompe, nome, nomeCompleto, participaCompe },
    });
    if (existente) atualizados++;
    else criados++;
  }

  console.log(`Importação concluída: ${criados} criados, ${atualizados} atualizados, ${ignorados} linhas ignoradas (sem ISPB/nome).`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
