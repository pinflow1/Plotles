import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TEMPORARY, ONE-TIME USE — same pattern as bootstrap-db through -v6.
// Adds User.realName: the optional private name a story owner sees when
// they tap an Anonymous Writer. Run this BEFORE deploying the code that
// reads the column — Prisma selects every column by default, so queries
// on "User" fail until it exists. Delete this file once it's run
// successfully.
//
// Visit: /api/bootstrap-db-v7?secret=<your JWT_SECRET value>

const STATEMENTS = [`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "realName" TEXT`];

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
