import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE, authCookieOptions, signSession, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.hashedPassword))) {
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }

    const token = await signSession({ userId: user.id });
    const res = NextResponse.json({
      user: { id: user.id, email: user.email, penName: user.penName, avatarUrl: user.avatarUrl, createdAt: user.createdAt },
    });
    res.cookies.set(AUTH_COOKIE, token, authCookieOptions());
    return res;
  } catch (err) {
    console.error("POST /api/auth/login failed:", err);
    // TEMPORARY: showing the real error so it's visible on-screen while
    // you're the only user — swap back to a generic message before this
    // has real users, so internals aren't exposed to them.
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Sign-in failed: ${detail}` }, { status: 500 });
  }
}
