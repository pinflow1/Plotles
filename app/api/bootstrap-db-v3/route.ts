import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TEMPORARY, ONE-TIME USE — same pattern as /api/bootstrap-db and
// /api/bootstrap-db-v2. Adds the columns/table the writer profile fields
// and collaboration requests need. Delete this file once it's run
// successfully.
//
// Visit: /api/bootstrap-db-v3?secret=<your JWT_SECRET value>

const STATEMENTS = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bio" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "genres" TEXT[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "interests" TEXT[] NOT NULL DEFAULT '{}'`,

  `DO $$ BEGIN
    CREATE TYPE "CollaborationRequestStatus" AS ENUM ('pending', 'accepted', 'rejected');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `CREATE TABLE IF NOT EXISTS "CollaborationRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "role" "CollaboratorRole" NOT NULL DEFAULT 'view',
    "message" TEXT,
    "status" "CollaborationRequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    CONSTRAINT "CollaborationRequest_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "CollaborationRequest_projectId_recipientId_status_key" ON "CollaborationRequest"("projectId", "recipientId", "status")`,

  `DO $$ BEGIN
    ALTER TABLE "CollaborationRequest" ADD CONSTRAINT "CollaborationRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "CollaborationRequest" ADD CONSTRAINT "CollaborationRequest_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "CollaborationRequest" ADD CONSTRAINT "CollaborationRequest_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
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
