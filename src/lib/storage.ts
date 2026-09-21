import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cliente S3 genérico (funciona com qualquer endpoint S3-compatível — AWS
 * S3, Cloudflare R2, Backblaze B2, MinIO — via as variáveis `S3_*` do
 * `.env`), pensado pra ser reusado por qualquer módulo que precise anexar
 * arquivo a um registro (o primeiro caso é `AnexoLancamento`, mas nada aqui
 * é específico do Financeiro). Nunca salva arquivo no Postgres — só a
 * `chaveStorage` do objeto no bucket. Bucket é sempre privado: todo acesso
 * passa por signed URL de curta duração (nunca URL pública permanente),
 * gerada sob demanda tanto pra upload (PUT) quanto pra leitura (GET).
 *
 * Singleton (mesmo espírito do `globalThis` de `src/lib/db.ts`) — o SDK
 * recomenda reusar uma única instância de client em vez de recriar a cada
 * chamada.
 */
let clienteSingleton: S3Client | null = null;

function obterBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET não configurado — ver .env.example.");
  return bucket;
}

function obterCliente(): S3Client {
  if (clienteSingleton) return clienteSingleton;

  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Configuração de storage (S3_ENDPOINT/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY) ausente — ver .env.example.");
  }

  clienteSingleton = new S3Client({
    endpoint,
    region: process.env.S3_REGION || "auto",
    credentials: { accessKeyId, secretAccessKey },
    // Necessário pra endpoints S3-compatíveis fora da AWS (R2, B2, MinIO) —
    // eles não suportam o estilo virtual-hosted-style (bucket.endpoint.com)
    // que o SDK usa por padrão.
    forcePathStyle: true,
  });
  return clienteSingleton;
}

const EXPIRACAO_URL_SEGUNDOS = 300;

/** URL assinada de upload (PUT) — o client faz o upload direto pro bucket, o arquivo nunca passa pelo servidor Next.js. */
export async function gerarUrlUpload(chaveStorage: string, tipoMime: string): Promise<string> {
  const comando = new PutObjectCommand({ Bucket: obterBucket(), Key: chaveStorage, ContentType: tipoMime });
  return getSignedUrl(obterCliente(), comando, { expiresIn: EXPIRACAO_URL_SEGUNDOS });
}

/** URL assinada de leitura (GET) — pra exibir/baixar um objeto já enviado. Expira em poucos minutos, gerar sob demanda, nunca cachear no banco. */
export async function gerarUrlDownload(chaveStorage: string): Promise<string> {
  const comando = new GetObjectCommand({ Bucket: obterBucket(), Key: chaveStorage });
  return getSignedUrl(obterCliente(), comando, { expiresIn: EXPIRACAO_URL_SEGUNDOS });
}

/** Remove um objeto do bucket — chamar só depois de já ter apagado (ou junto com) o registro de metadado correspondente. */
export async function excluirObjeto(chaveStorage: string): Promise<void> {
  await obterCliente().send(new DeleteObjectCommand({ Bucket: obterBucket(), Key: chaveStorage }));
}

export type RegraArquivo = { tiposPermitidos: readonly string[]; tamanhoMaximoBytes: number };

/** Validação de tipo/tamanho reusável por qualquer módulo que aceite upload — cada um define suas próprias regras (ver `REGRAS_ANEXO_LANCAMENTO` como exemplo). */
export function validarArquivo(arquivo: { tipoMime: string; tamanhoBytes: number }, regras: RegraArquivo): string | null {
  if (!regras.tiposPermitidos.includes(arquivo.tipoMime)) {
    return `Tipo de arquivo não permitido. Aceitos: ${regras.tiposPermitidos.join(", ")}.`;
  }
  if (arquivo.tamanhoBytes > regras.tamanhoMaximoBytes) {
    return `Arquivo maior que o limite de ${Math.round(regras.tamanhoMaximoBytes / (1024 * 1024))} MB.`;
  }
  return null;
}
