import { PrismaClient } from "@prisma/client";
import { CreateSiteInput } from "./src/validators/site.validators";

const prisma = new PrismaClient();

async function run() {
  const input: CreateSiteInput = {
    name: "test site",
    baseUrl: "https://test.com",
    key: "test-site-2",
  };
  
  try {
     const newSite = await prisma.site.create({
        data: input as any // bypass type temporarily to see the DB error
     });
     console.log("Success", newSite);
  } catch (err) {
     console.error("Prisma Error", err);
  } finally {
     await prisma.$disconnect();
  }
}
run();
