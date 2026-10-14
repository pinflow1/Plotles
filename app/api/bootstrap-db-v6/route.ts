import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TEMPORARY, ONE-TIME USE — same pattern as bootstrap-db through -v5.
// Fixes the database side of the join-request flow:
//   1. Drops every unique index/constraint on CollaborationRequest except
//      the primary key. The old one, (projectId, recipientId, status),
//      allowed one pending, one accepted and one rejected request per
//      story in total, because on a join request the recipient is always
//      the owner.
//   2. Adds a partial unique index instead: at most one PENDING request
//      per (project, initiator, recipient).
//   3. Repairs owner access rows the old accept handler overwrote. It
//      granted the join to the signed-in user (the owner) instead of the
//      writer, which set the owner's role to "edit" and, in anonymous
//      modes, gave the owner an Anonymous Writer number.
// Safe to re-run. Delete this file once it's run successfully. Don't
// re-run -v4 afterwards — it would recreate the old index.
//
// Visit: /api/bootstrap-db-v6?secret=<your JWT_SECRET value>

const NEW_INDEX = "CollaborationRequest_pending_pair_key";

const UNIQUE_INDEXES_SQL = `
  SELECT i.relname AS name, pg_get_indexdef(i.oid) AS def
  FROM pg_index x
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_class t ON t.oid = x.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname = 'CollaborationRequest'
    AND n.nspname = current_schema()
    AND x.indisunique
    AND NOT x.indisprimary
`;

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.JWT_SECRET) {
    return NextResponse.json({ error: "Missing or wrong secret." }, { status: 401 });
  }

  const dropped: string[] = [];
  try {
    const found = await prisma.$queryRawUnsafe<{ name: string; def: string }[]>(UNIQUE_INDEXES_SQL);
    for (const { name } of found) {
      if (name === NEW_INDEX) continue;
      // A unique constraint owns its index and must be dropped as a
      // constraint; a plain unique index drops directly. Each statement is
      // a no-op when the other form was used.
      await prisma.$executeRawUnsafe(`ALTER TABLE "CollaborationRequest" DROP CONSTRAINT IF EXISTS ${quoteIdent(name)}`);
      await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS ${quoteIdent(name)}`);
      dropped.push(name);
    }

    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdent(NEW_INDEX)} ON "CollaborationRequest" ("projectId", "initiatorId", "recipientId") WHERE "status" = 'pending'`
    );

    const ownerRowsRepaired = await prisma.$executeRawUnsafe(
      `UPDATE "ProjectAccess" a
       SET "role" = 'owner', "isAnonymous" = false, "anonymousNumber" = NULL
       FROM "Project" p
       WHERE a."projectId" = p."id" AND a."userId" = p."ownerId"
         AND (a."role" <> 'owner' OR a."isAnonymous" = true OR a."anonymousNumber" IS NOT NULL)`
    );

    const uniqueIndexesNow = await prisma.$queryRawUnsafe<{ name: string; def: string }[]>(UNIQUE_INDEXES_SQL);

    return NextResponse.json({
      ok: true,
      message: "Migration complete. Delete this route now.",
      droppedIndexes: dropped,
      ownerRowsRepaired,
      uniqueIndexesNow,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), droppedIndexes: dropped },
      { status: 500 }
    );
  }
}
