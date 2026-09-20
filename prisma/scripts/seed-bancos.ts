import "dotenv/config";
import { db } from "@/lib/db";

/**
 * Lista reduzida pra desenvolvimento/primeiro boot — não é a fonte de
 * verdade. Antes de produção, rodar `scripts/importar-bancos.ts` pra
 * sincronizar com o CSV oficial do Bacen (Portal de Dados Abertos).
 */
// Valores conferidos linha a linha contra o CSV oficial do Bacen
// (ParticipantesSTR.csv) em 2026-09-19 — a lista originalmente rascunhada
// nesta spec tinha 11 de 26 ISPBs errados (alguns trocados entre si, ex.:
// PicPay/C6, Mercado Pago/PicPay, e um caso de ISPB duplicado entre Nubank e
// PagSeguro). Preferir sempre `importar-bancos.ts` — este array é só
// fallback pra ambiente sem internet.
export const BANCOS_SEED_INICIAL = [
  { codigoCompe: "001", ispb: "00000000", nome: "Banco do Brasil" },
  { codigoCompe: "033", ispb: "90400888", nome: "Santander" },
  { codigoCompe: "104", ispb: "00360305", nome: "Caixa Econômica Federal" },
  { codigoCompe: "237", ispb: "60746948", nome: "Bradesco" },
  { codigoCompe: "341", ispb: "60701190", nome: "Itaú Unibanco" },
  { codigoCompe: "070", ispb: "00000208", nome: "BRB - Banco de Brasília" },
  { codigoCompe: "077", ispb: "00416968", nome: "Banco Inter" },
  { codigoCompe: "260", ispb: "18236120", nome: "Nu Pagamentos (Nubank)" },
  { codigoCompe: "290", ispb: "08561701", nome: "PagSeguro Internet" },
  { codigoCompe: "323", ispb: "10573521", nome: "Mercado Pago" },
  { codigoCompe: "336", ispb: "31872495", nome: "Banco C6" },
  { codigoCompe: "380", ispb: "22896431", nome: "PicPay" },
  { codigoCompe: "422", ispb: "58160789", nome: "Banco Safra" },
  { codigoCompe: "003", ispb: "04902979", nome: "Banco da Amazônia" },
  { codigoCompe: "041", ispb: "92702067", nome: "Banrisul" },
  { codigoCompe: "021", ispb: "28127603", nome: "Banestes" },
  { codigoCompe: "004", ispb: "07237373", nome: "Banco do Nordeste" },
  { codigoCompe: "025", ispb: "03323840", nome: "Banco Alfa" },
  { codigoCompe: "246", ispb: "28195667", nome: "Banco ABC Brasil" },
  { codigoCompe: "756", ispb: "02038232", nome: "Sicoob" },
  { codigoCompe: "748", ispb: "01181521", nome: "Sicredi" },
  { codigoCompe: "623", ispb: "59285411", nome: "Banco Pan" },
  { codigoCompe: "655", ispb: "59588111", nome: "Banco Votorantim (BV)" },
  { codigoCompe: "745", ispb: "33479023", nome: "Citibank" },
  { codigoCompe: "269", ispb: "53518684", nome: "HSBC Bank Brasil" },
  { codigoCompe: "637", ispb: "60889128", nome: "Banco Sofisa" },
];

async function main() {
  for (const banco of BANCOS_SEED_INICIAL) {
    await db.banco.upsert({
      where: { ispb: banco.ispb },
      update: { nome: banco.nome, codigoCompe: banco.codigoCompe },
      create: banco,
    });
  }
  console.log(`Seed concluído: ${BANCOS_SEED_INICIAL.length} bancos.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
