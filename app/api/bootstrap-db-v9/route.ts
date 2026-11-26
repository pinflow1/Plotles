import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TEMPORARY, ONE-TIME USE — same pattern as bootstrap-db through -v8.
// Adds what Report & Block needs:
//   "Block"  — who blocked whom (one row per pair; both directions are
//              checked in code)
//   "Report" — a report about a writer, a story or a collaboration request,
//              with a saved copy of what was reported ("snapshot") so that
//              deleting the content doesn't erase the evidence
//   "User"."suspendedAt" and "Project"."moderationHidden" — the two
//              moderation switches
// Run this BEFORE deploying the code that reads the new columns — Prisma
// selects every column by default, so queries on "User" and "Project" fail
// until they exist. Delete this file once it's run successfully.
//
// Visit: /api/bootstrap-db-v9?secret=<your JWT_SECRET value>

function fk(table: string, column: string, ref: string) {
  return `DO $$ BEGIN
    ALTER TABLE "${table}" ADD CONSTRAINT "${table}_${column}_fkey" FOREIGN KEY ("${column}") REFERENCES "${ref}"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
}

const STATEMENTS = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3)`,
  `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "moderationHidden" BOOLEAN NOT NULL DEFAULT false`,

  `CREATE TABLE IF NOT EXISTS "Block" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId")`,
  `CREATE INDEX IF NOT EXISTS "Block_blockedId_idx" ON "Block"("blockedId")`,
  fk("Block", "blockerId", "User"),
  fk("Block", "blockedId", "User"),

  `CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetProjectId" TEXT,
    "targetRequestId" TEXT,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "snapshot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "Report_status_createdAt_idx" ON "Report"("status", "createdAt")`,
  fk("Report", "reporterId", "User"),
  fk("Report", "targetUserId", "User"),
  fk("Report", "targetProjectId", "Project"),
  fk("Report", "targetRequestId", "CollaborationRequest"),
];

// What must exist afterwards. The route checks this itself so the output
// says "ok" or names exactly what is missing.
const EXPECTED = [
  "table:Block",
  "table:Report",
  "column:User.suspendedAt",
  "column:Project.moderationHidden",
  "fk:Block_blockerId_fkey",
  "fk:Block_blockedId_fkey",
  "fk:Report_reporterId_fkey",
  "fk:Report_targetUserId_fkey",
  "fk:Report_targetProjectId_fkey",
  "fk:Report_targetRequestId_fkey",
];

const FK_NAMES = EXPECTED.filter((n) => n.startsWith("fk:"))
  .map((n) => `'${n.slice(3)}'`)
  .join(", ");

const CHECK_SQL = `
  SELECT 'table:' || table_name::text AS name FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name IN ('Block', 'Report')
  UNION ALL
  SELECT 'column:' || table_name::text || '.' || column_name::text FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND ((table_name = 'User' AND column_name = 'suspendedAt')
        OR (table_name = 'Project' AND column_name = 'moderationHidden'))
  UNION ALL
  SELECT 'fk:' || conname::text FROM pg_constraint
    WHERE contype = 'f' AND conname IN (${FK_NAMES})
`;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.JWT_SECRET) {
    return NextResponse.json({ error: "Missing or wrong secret." }, { status: 401 });
  }

  const done: string[] = [];
  try {
    for (const sql of STATEMENTS) {
      await prisma.$executeRawUnsafe(sql);
      done.push(sql.trim().slice(0, 60).replace(/\s+/g, " ") + "…");
    }

    const found = await prisma.$queryRawUnsafe<{ name: string }[]>(CHECK_SQL);
    const have = found.map((r) => r.name);
    const missing = EXPECTED.filter((n) => !have.includes(n));

    if (missing.length > 0) {
      return NextResponse.json(
        { ok: false, message: "Something is missing — send this output back.", missing, completed: done },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      message: "Migration complete. Delete this route now.",
      statementsRun: done.length,
      missing,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), completed: done },
      { status: 500 }
    );
  }
}
