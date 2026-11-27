import { prisma } from "@/lib/prisma";

// Blocks are checked in both directions: if either writer has blocked the
// other, the pair must not see or reach each other. A block never changes
// who is in a story they already share.

/** Ids of everyone this writer has blocked or been blocked by. One query. */
export async function blockedWith(userId: string): Promise<string[]> {
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) ids.add(r.blockerId === userId ? r.blockedId : r.blockerId);
  return Array.from(ids);
}

/** True when either of the two has blocked the other. */
export async function areBlocked(a: string, b: string): Promise<boolean> {
  const row = await prisma.block.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    select: { id: true },
  });
  return row !== null;
}
