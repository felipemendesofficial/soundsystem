import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";

async function main() {
  const deposito = await db.deposito.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      nome: "Loja Principal",
      endereco: null,
    },
  });

  const senhaHashAdmin = await bcrypt.hash("admin123", 10);
  const senhaHashEstoquista = await bcrypt.hash("estoque123", 10);
  const senhaHashVendedor = await bcrypt.hash("venda123", 10);

  await db.usuario.upsert({
    where: { email: "admin@exemplo.com" },
    update: {},
    create: {
      nome: "Administrador",
      email: "admin@exemplo.com",
      senhaHash: senhaHashAdmin,
      perfil: "admin",
      depositoPadraoId: deposito.id,
    },
  });

  await db.usuario.upsert({
    where: { email: "estoquista@exemplo.com" },
    update: {},
    create: {
      nome: "Estoquista Teste",
      email: "estoquista@exemplo.com",
      senhaHash: senhaHashEstoquista,
      perfil: "estoquista",
      depositoPadraoId: deposito.id,
    },
  });

  await db.usuario.upsert({
    where: { email: "vendedor@exemplo.com" },
    update: {},
    create: {
      nome: "Vendedor Teste",
      email: "vendedor@exemplo.com",
      senhaHash: senhaHashVendedor,
      perfil: "vendedor",
      depositoPadraoId: deposito.id,
    },
  });

  console.log("Seed concluído.");
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
