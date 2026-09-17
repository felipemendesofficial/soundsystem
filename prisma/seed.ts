import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";

async function main() {
  const grupo = await db.grupoEmpresarial.upsert({
    where: { id: "00000000-0000-0000-0000-000000000010" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000010",
      nome: "Grupo Teste",
    },
  });

  const empresa = await db.empresa.upsert({
    where: { id: "00000000-0000-0000-0000-000000000011" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000011",
      grupoId: grupo.id,
      nome: "Empresa Teste",
    },
  });

  const deposito = await db.deposito.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      empresaId: empresa.id,
      nome: "Loja Principal",
      endereco: null,
    },
  });

  // Credenciais do master vêm de env (MASTER_EMAIL/MASTER_SENHA em .env, nunca
  // commitado) pra não gravar a senha real em texto puro no seed — sem elas,
  // cai no login de teste de sempre.
  const emailMaster = process.env.MASTER_EMAIL ?? "master@exemplo.com";
  const senhaMaster = process.env.MASTER_SENHA ?? "master123";

  const senhaHashMaster = await bcrypt.hash(senhaMaster, 10);
  const senhaHashAdmin = await bcrypt.hash("admin123", 10);
  const senhaHashEstoquista = await bcrypt.hash("estoque123", 10);
  const senhaHashVendedor = await bcrypt.hash("venda123", 10);

  // Master: usuário de plataforma, sem grupo — cria Grupos/Empresas via /admin.
  await db.usuario.upsert({
    where: { email: emailMaster },
    update: { senhaHash: senhaHashMaster },
    create: {
      nome: "Master",
      email: emailMaster,
      senhaHash: senhaHashMaster,
      perfil: "master",
    },
  });

  const admin = await db.usuario.upsert({
    where: { email: "admin@exemplo.com" },
    update: {},
    create: {
      nome: "Administrador",
      email: "admin@exemplo.com",
      senhaHash: senhaHashAdmin,
      perfil: "admin",
      grupoId: grupo.id,
    },
  });

  const estoquista = await db.usuario.upsert({
    where: { email: "estoquista@exemplo.com" },
    update: {},
    create: {
      nome: "Estoquista Teste",
      email: "estoquista@exemplo.com",
      senhaHash: senhaHashEstoquista,
      perfil: "estoquista",
      grupoId: grupo.id,
    },
  });

  const vendedor = await db.usuario.upsert({
    where: { email: "vendedor@exemplo.com" },
    update: {},
    create: {
      nome: "Vendedor Teste",
      email: "vendedor@exemplo.com",
      senhaHash: senhaHashVendedor,
      perfil: "vendedor",
      grupoId: grupo.id,
    },
  });

  // Acesso à Empresa Teste (com depósito padrão) pros 3 usuários não-master.
  for (const usuario of [admin, estoquista, vendedor]) {
    await db.usuarioEmpresa.upsert({
      where: { usuarioId_empresaId: { usuarioId: usuario.id, empresaId: empresa.id } },
      update: {},
      create: {
        usuarioId: usuario.id,
        empresaId: empresa.id,
        depositoPadraoId: deposito.id,
      },
    });
  }

  // Alíneas de Devolução de Cheque (tabela Bacen) — módulo financeiro.
  const alineasDevolucaoCheque = [
    { codigo: "11", descricao: "Cheque sem fundos – 1ª apresentação" },
    { codigo: "12", descricao: "Cheque sem fundos – 2ª apresentação" },
    { codigo: "13", descricao: "Conta encerrada" },
    { codigo: "14", descricao: "Prática espúria (emissão de múltiplos cheques de baixo valor sem fundos)" },
    { codigo: "20", descricao: "Folha de cheque cancelada por solicitação do correntista" },
    { codigo: "21", descricao: "Contra-ordem (revogação) ou oposição (sustação) ao pagamento pelo emitente" },
    { codigo: "22", descricao: "Divergência ou insuficiência de assinatura" },
    { codigo: "23", descricao: "Cheque de órgão da administração pública em desacordo com normas" },
    { codigo: "24", descricao: "Bloqueio judicial ou determinação do Banco Central" },
    { codigo: "25", descricao: "Cancelamento de talonário pelo banco sacado" },
    { codigo: "26", descricao: "Inoperância temporária de transporte" },
    { codigo: "27", descricao: "Feriado municipal não previsto" },
    { codigo: "28", descricao: "Contra-ordem ou oposição ocasionada por furto ou roubo" },
    { codigo: "31", descricao: "Erros formais (como falta de data, valor por extenso incorreto ou rasura)" },
    { codigo: "33", descricao: "Divergência de endosso" },
    { codigo: "34", descricao: "Cheque apresentado por estabelecimento não inscrito no compensador" },
    { codigo: "35", descricao: "Cheque não cruzado quando exigido" },
    { codigo: "37", descricao: "Registro inconsistente ou erro de processamento operacional" },
    { codigo: "44", descricao: "Cheque prescrito (apresentado após o prazo legal)" },
    { codigo: "45", descricao: "Cheque emitido por entidade obrigada a emitir ordem bancária ou com oposição de furto/roubo" },
    { codigo: "48", descricao: "Cheque de valor superior a R$ 100,00 sem a identificação do beneficiário" },
    { codigo: "49", descricao: "Remessa nula (reapresentação indevida de cheque que não deveria retornar ao sistema de compensação)" },
  ];

  for (const alinea of alineasDevolucaoCheque) {
    await db.alineaDevolucaoCheque.upsert({
      where: { codigo: alinea.codigo },
      update: { descricao: alinea.descricao },
      create: alinea,
    });
  }

  console.log("Seed concluído.");
  console.log(`Login master:     ${emailMaster} / ${senhaMaster}`);
  console.log("Login admin:      admin@exemplo.com / admin123");
  console.log("Login estoquista: estoquista@exemplo.com / estoque123");
  console.log("Login vendedor:   vendedor@exemplo.com / venda123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
