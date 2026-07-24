import { cleanup } from "@/scripts/seed-demo";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("=== Removendo dados de demonstração (@demo.trevo.app) ===");
  const removedCount = await cleanup();
  console.log(`Usuários demo removidos: ${removedCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
