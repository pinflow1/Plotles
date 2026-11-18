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
    // The real cause goes to Vercel's Runtime Logs; the person signing in only
    // gets a plain message, so internals aren't exposed.
    console.error("POST /api/auth/login failed:", err);
    return NextResponse.json({ error: "We couldn't sign you in just now. Please try again in a moment." }, { status: 500 });
  }
}
