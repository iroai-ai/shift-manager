import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

let _instance: PrismaClient | undefined;

function createClient(): PrismaClient {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    if (!_instance) _instance = createClient();
    const value = (_instance as any)[prop];
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});
