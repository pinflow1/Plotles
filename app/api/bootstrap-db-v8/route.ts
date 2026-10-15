import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TEMPORARY, ONE-TIME USE — same pattern as bootstrap-db through -v7.
// Adds Project.previewText: the excerpt an owner chooses to share with
// writers browsing Find Stories. Run this BEFORE deploying the code that
// reads the column — Prisma selects every column by default, so queries
// on "Project" fail until it exists. Delete this file once it's run
// successfully.
//
// Visit: /api/bootstrap-db-v8?secret=<your JWT_SECRET value>

const STATEMENTS = [`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "previewText" TEXT`];

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
