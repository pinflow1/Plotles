import { PrismaClient } from "@prisma/client";

// Next.js dev hot-reloads modules, which would otherwise spawn a fresh
// PrismaClient (and a fresh connection pool) on every edit. Caching the
// instance on `global` in development sidesteps that.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
