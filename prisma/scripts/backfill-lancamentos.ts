/**
 * Reconstrói o cabeçalho (Lancamento) de movimentos avulsos antigos — feitos
 * pela extinta "Nova Movimentação" instantânea, antes do Lançamento existir
 * como entidade — dando a eles a mesma paridade dos lançamentos novos
 * (aparecem em /lancamentos, podem usar "Cancelar Fechamento").
 *
 * Chave de agrupamento: todos os itens de UM lançamento original foram
 * gravados na mesma chamada de servidor, em sequência — mas o `criado_em`
 * NÃO é idêntico entre eles (o Prisma materializa `now()` no client por
 * INSERT, não deixa pro DEFAULT do Postgres, então cada linha pega um
 * timestamp de alguns milissegundos de diferença). Por isso agrupamos por
 * mesmos campos de cabeçalho (tipo, depósito(s), cliente/fornecedor/
 * vendedor, observação, usuário) + proximidade de tempo: linhas cujo
 * `criado_em` fica a até `JANELA_MS` da anterior no mesmo grupo entram
 * juntas; um gap maior que isso encerra o lançamento e começa outro. Uma
 * janela generosa o bastante pra cobrir um envio com vários itens
 * processados em sequência, mas bem menor que o intervalo típico entre
 * duas ações distintas do usuário.
 *
 * Deliberadamente NÃO backfilla: movimentos já vinculados a OS/Orçamento/
 * Lançamento (têm dono), já estornados, ou que SÃO um estorno — encaixar um
 * estorno já resolvido num cabeçalho "Fechado" não faz sentido pro
 * "Cancelar Fechamento".
 *
 * Idempotente: só considera movimentos com `lancamento_id IS NULL`, então
 * pode ser reexecutado com segurança (retoma de onde parou).
 *
 * Uso:
 *   npx tsx --env-file=.env prisma/scripts/backfill-lancamentos.ts [--dry-run]
 */
import { db } from "@/lib/db";
import { TipoMovimento, type Movimentacao } from "@/generated/prisma/client";

const dryRun = process.argv.includes("--dry-run");
const JANELA_MS = 5000;

const TIPOS_ENTRADA = new Set<TipoMovimento>(["compra", "devolucao_cliente", "ajuste_entrada"]);

function chaveHeader(m: Movimentacao, extra: string) {
  return [m.usuarioId, m.observacao ?? "", extra].join("|");
}

/** Agrupa itens já ordenados por `criadoEm` em blocos onde o gap pro anterior é <= JANELA_MS. */
function agruparPorJanelaDeTempo<T>(itens: T[], criadoEm: (item: T) => Date): T[][] {
  const grupos: T[][] = [];
  let atual: T[] = [];
  let ultimoTempo: number | null = null;

  for (const item of itens) {
    const tempo = criadoEm(item).getTime();
    if (ultimoTempo !== null && tempo - ultimoTempo > JANELA_MS) {
      grupos.push(atual);
      atual = [];
    }
    atual.push(item);
    ultimoTempo = tempo;
  }
  if (atual.length > 0) grupos.push(atual);
  return grupos;
}

async function main() {
  console.log(`== Backfill de cabeçalho de Lançamento${dryRun ? " (dry-run)" : ""} ==`);

  const orfaos = await db.movimentacao.findMany({
    where: {
      lancamentoId: null,
      ordemServicoId: null,
      orcamentoId: null,
      estornadoEm: null,
      estornoDeId: null,
    },
    orderBy: { criadoEm: "asc" },
  });

  if (orfaos.length === 0) {
    console.log("Nenhum movimento órfão encontrado. Nada a fazer.");
    return;
  }
  console.log(`${orfaos.length} movimento(s) órfão(s) encontrado(s).`);

  const transferenciaSaida = orfaos.filter((m) => m.tipoMovimento === "transferencia_saida");
  const transferenciaEntrada = orfaos.filter((m) => m.tipoMovimento === "transferencia_entrada");
  const demais = orfaos.filter(
    (m) => m.tipoMovimento !== "transferencia_saida" && m.tipoMovimento !== "transferencia_entrada"
  );

  // --- Pareia pernas de transferência: mesmo produto/quantidade/observação/
  // usuário, casando com a entrada de criado_em mais próximo (dentro da
  // janela) em vez de exigir timestamp idêntico. ---
  type ParTransferencia = { saida: Movimentacao; entrada: Movimentacao };
  const pares: ParTransferencia[] = [];
  const entradasRestantes = [...transferenciaEntrada];
  for (const saida of transferenciaSaida) {
    let melhorIdx = -1;
    let menorGap = Infinity;
    entradasRestantes.forEach((e, idx) => {
      if (
        e.produtoId !== saida.produtoId ||
        e.quantidade.toString() !== saida.quantidade.toString() ||
        (e.observacao ?? "") !== (saida.observacao ?? "") ||
        e.usuarioId !== saida.usuarioId
      ) {
        return;
      }
      const gap = Math.abs(e.criadoEm.getTime() - saida.criadoEm.getTime());
      if (gap <= JANELA_MS && gap < menorGap) {
        menorGap = gap;
        melhorIdx = idx;
      }
    });
    if (melhorIdx === -1) {
      console.warn(
        `AVISO: transferência órfã sem par encontrado (movimento ${saida.id}, produto ${saida.produtoId}) — pulando.`
      );
      continue;
    }
    pares.push({ saida, entrada: entradasRestantes[melhorIdx] });
    entradasRestantes.splice(melhorIdx, 1);
  }
  if (entradasRestantes.length > 0) {
    console.warn(`AVISO: ${entradasRestantes.length} entrada(s) de transferência sem par de saída — pulando.`);
  }
  pares.sort((a, b) => a.saida.criadoEm.getTime() - b.saida.criadoEm.getTime());

  // --- Agrupa pares de transferência em Lançamentos: mesmo cabeçalho +
  // janela de tempo entre pares consecutivos ---
  const gruposTransferencia: ParTransferencia[][] = [];
  const fingerprintsTransferencia = new Map<string, ParTransferencia[]>();
  for (const par of pares) {
    const chave = chaveHeader(par.saida, `${par.saida.depositoId}>${par.entrada.depositoId}`);
    const grupo = fingerprintsTransferencia.get(chave) ?? [];
    grupo.push(par);
    fingerprintsTransferencia.set(chave, grupo);
  }
  for (const grupo of fingerprintsTransferencia.values()) {
    gruposTransferencia.push(...agruparPorJanelaDeTempo(grupo, (par) => par.saida.criadoEm));
  }

  // --- Agrupa entradas/saídas comuns em Lançamentos: mesmo cabeçalho +
  // janela de tempo entre movimentos consecutivos ---
  const gruposComuns: Movimentacao[][] = [];
  const fingerprintsComuns = new Map<string, Movimentacao[]>();
  for (const m of demais) {
    const chave = chaveHeader(
      m,
      [m.tipoMovimento, m.depositoId, m.clienteId ?? "", m.fornecedorId ?? "", m.vendedorId ?? ""].join(":")
    );
    const grupo = fingerprintsComuns.get(chave) ?? [];
    grupo.push(m);
    fingerprintsComuns.set(chave, grupo);
  }
  for (const grupo of fingerprintsComuns.values()) {
    gruposComuns.push(...agruparPorJanelaDeTempo(grupo, (m) => m.criadoEm));
  }

  console.log(
    `${gruposComuns.length} lançamento(s) de compra/venda/ajuste/devolução + ${gruposTransferencia.length} de transferência a reconstruir.`
  );

  let criados = 0;

  for (const movs of gruposComuns) {
    const base = movs[0];
    const tipo = base.tipoMovimento as
      | "compra"
      | "devolucao_cliente"
      | "ajuste_entrada"
      | "venda"
      | "devolucao_fornecedor"
      | "perda_avaria"
      | "uso_interno"
      | "ajuste_saida";
    const ehEntrada = TIPOS_ENTRADA.has(base.tipoMovimento);

    if (dryRun) {
      console.log(
        `[dry-run] Lançamento ${tipo} — depósito ${base.depositoId} — ${movs.length} item(ns) — ${base.criadoEm.toISOString()}`
      );
      continue;
    }

    await db.$transaction(async (tx) => {
      const lancamento = await tx.lancamento.create({
        data: {
          tipo,
          status: "fechado",
          depositoId: base.depositoId,
          fornecedorId: base.fornecedorId,
          clienteId: base.clienteId,
          vendedorId: base.vendedorId,
          usuarioId: base.usuarioId,
          observacao: base.observacao,
          criadoEm: base.criadoEm,
          fechadoEm: base.criadoEm,
          itens: {
            create: movs.map((m) => ({
              produtoId: m.produtoId,
              quantidade: m.quantidade,
              custoUnitario: ehEntrada ? m.custoUnitario : null,
              precoVenda: !ehEntrada ? m.precoVenda : null,
            })),
          },
        },
      });

      await tx.movimentacao.updateMany({
        where: { id: { in: movs.map((m) => m.id) } },
        data: { lancamentoId: lancamento.id },
      });
    });
    criados += 1;
  }

  for (const grupo of gruposTransferencia) {
    const base = grupo[0].saida;

    if (dryRun) {
      console.log(
        `[dry-run] Lançamento transferência — ${base.depositoId} → ${grupo[0].entrada.depositoId} — ${grupo.length} item(ns) — ${base.criadoEm.toISOString()}`
      );
      continue;
    }

    await db.$transaction(async (tx) => {
      const lancamento = await tx.lancamento.create({
        data: {
          tipo: "transferencia",
          status: "fechado",
          depositoOrigemId: base.depositoId,
          depositoDestinoId: grupo[0].entrada.depositoId,
          usuarioId: base.usuarioId,
          observacao: base.observacao,
          criadoEm: base.criadoEm,
          fechadoEm: base.criadoEm,
          itens: {
            create: grupo.map((par) => ({
              produtoId: par.saida.produtoId,
              quantidade: par.saida.quantidade,
            })),
          },
        },
      });

      const idsEnvolvidos = grupo.flatMap((par) => [par.saida.id, par.entrada.id]);
      await tx.movimentacao.updateMany({
        where: { id: { in: idsEnvolvidos } },
        data: { lancamentoId: lancamento.id },
      });
    });
    criados += 1;
  }

  if (dryRun) {
    console.log("\nDry-run concluído — nenhuma alteração foi gravada.");
  } else {
    console.log(`\nOK: ${criados} Lançamento(s) reconstruído(s).`);
  }
}

main()
  .catch((e) => {
    console.error("FALHA:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
