import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TEMPORARY, ONE-TIME USE — same pattern as /api/bootstrap-db. Adds the
// columns/table the streak, goal, and status features need. Delete this
// file once it's run successfully.
//
// Visit: /api/bootstrap-db-v2?secret=<your JWT_SECRET value>

const STATEMENTS = [
  `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "goalWordCount" INTEGER`,
  `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMP(3)`,

  `DO $$ BEGIN
    CREATE TYPE "ProjectStatus" AS ENUM ('planning', 'drafting', 'revising', 'complete');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "status" "ProjectStatus" NOT NULL DEFAULT 'drafting'`,

  `CREATE TABLE IF NOT EXISTS "WritingLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "words" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WritingLog_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WritingLog_userId_projectId_date_key" ON "WritingLog"("userId", "projectId", "date")`,

  `DO $$ BEGIN
    ALTER TABLE "WritingLog" ADD CONSTRAINT "WritingLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "WritingLog" ADD CONSTRAINT "WritingLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), completed: done },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, message: "Migration complete. Delete this route now.", completed: done });
  }
