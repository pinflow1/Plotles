import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE, authCookieOptions, hashPassword, signSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const penName = typeof body?.penName === "string" ? body.penName.trim() : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!penName) {
    return NextResponse.json({ error: "Enter a pen name." }, { status: 400 });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: { email, penName, hashedPassword: await hashPassword(password) },
      select: { id: true, email: true, penName: true, avatarUrl: true, createdAt: true },
    });

    const token = await signSession({ userId: user.id });
    const res = NextResponse.json({ user }, { status: 201 });
    res.cookies.set(AUTH_COOKIE, token, authCookieOptions());
    return res;
  } catch (err) {
    // Logged here so the real cause (e.g. DB unreachable, or `prisma db
    // push` never run against this database) shows up in Vercel's Runtime
    // Logs, instead of only a bare 500 reaching the client.
    console.error("POST /api/auth/register failed:", err);
    // TEMPORARY: showing the real error so it's visible on-screen while
    // you're the only user — swap back to a generic message before this
    // has real users, so internals aren't exposed to them.
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Registration failed: ${detail}` }, { status: 500 });
  }
}
