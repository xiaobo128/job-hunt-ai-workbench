const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.application.updateMany({
    where: { currentStage: "INTERESTED" },
    data: { currentStage: "READY_TO_APPLY" }
  });

  await prisma.jobLead.updateMany({
    where: { status: "INTERESTED" },
    data: { status: "READY_TO_APPLY" }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
