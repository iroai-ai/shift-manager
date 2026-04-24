import type { PrismaClient } from "@prisma/client/edge";
import type { PrismaPg } from "@prisma/adapter-pg";

// Both the pg Pool and the PrismaClient are created lazily (inside createClient),
// so they are never evaluated during Next.js build-time edge sandbox module checks.
// At Cloudflare Workers runtime, @cloudflare/next-on-pages (esbuild + nodejs_compat)
// bundles pg correctly so these require() calls succeed.

let _instance: PrismaClient | undefined;

function createClient(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient: PC } = require("@prisma/client/edge") as typeof import("@prisma/client/edge");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg: Adapter } = require("@prisma/adapter-pg") as { PrismaPg: typeof PrismaPg };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as typeof import("pg");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new Adapter(pool);
  return new PC({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// Proxy so the module can be imported and re-exported without instantiating
// the PrismaClient during build-time module evaluation.
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    if (!_instance) {
      _instance = createClient();
    }
    const value = (_instance as any)[prop];
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});
