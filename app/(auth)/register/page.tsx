"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const [penName, setPenName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/auth/register", { penName, email, password });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="text-xs font-bold tracking-[0.16em] text-text">PLOTLESS</div>
          <h1 className="mt-6 font-serif text-2xl text-text">Start writing</h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-soft">Pen name</span>
            <input
              type="text"
              required
              autoComplete="name"
              value={penName}
              onChange={(e) => setPenName(e.target.value)}
              placeholder="How your collaborators will see you"
              className="mt-2 w-full border-b border-divider bg-transparent py-2 text-text placeholder:text-text-soft/60 outline-none focus-visible:border-text"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-soft">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full border-b border-divider bg-transparent py-2 text-text outline-none focus-visible:border-text"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-soft">Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="mt-2 w-full border-b border-divider bg-transparent py-2 text-text placeholder:text-text-soft/60 outline-none focus-visible:border-text"
            />
          </label>

          {error && <p className="text-sm text-text">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-strong py-3 text-sm font-semibold text-on-strong transition-opacity active:opacity-85 disabled:opacity-60"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-text-soft">
          Already writing on Plotless?{" "}
          <Link href="/login" className="text-text underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
