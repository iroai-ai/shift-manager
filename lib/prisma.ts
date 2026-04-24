import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";

// Defer instantiation so new PrismaClient() is never called during
// Next.js build-time module evaluation (which runs in a strict edge sandbox).
// The real client is created on first property access at request time.
let _instance: ReturnType<typeof createClient> | undefined;

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }).$extends(withAccelerate());
}

export const prisma = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop: string | symbol) {
    if (!_instance) {
      _instance = createClient();
    }
    const value = (_instance as any)[prop];
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});
