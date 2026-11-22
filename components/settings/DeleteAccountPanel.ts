"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";

type Summary = {
  ownedStories: { id: string; title: string; otherWriters: number }[];
  contributedTo: number;
};

// The "Delete account" section at the bottom of Settings: look at what would
// go, enter your password, done. Permanent, so it says exactly what's lost
// before asking for anything.
export function DeleteAccountPanel() {
  const [step, setStep] = useState<"closed" | "loading" | "confirm" | "done">("closed");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leftovers, setLeftovers] = useState(0);

  async function open() {
    setError(null);
    setPassword("");
    setStep("loading");
    try {
      setSummary(await api.get<Summary>("/api/account"));
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load that. Please try again.");
      setStep("closed");
    }
  }

  async function confirm() {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      // A plain fetch: the shared api helper's delete() can't send a body.
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : `Something went wrong (${res.status}). Please try again.`);
      setLeftovers(typeof data?.leftovers === "number" ? data.leftovers : 0);
      setStep("done");
    } catch (err) {
      // A dropped connection arrives as a bare TypeError ("Failed to fetch").
      setError(
        err instanceof TypeError
          ? "Couldn't reach Plotless. Check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Couldn't delete your account. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  const owned = summary?.ownedStories ?? [];

  return (
    <section className="mt-10 border-t border-divider pt-5">
      <div className="mb-1.5 px-1 text-xs uppercase tracking-[0.08em] text-text-soft">Delete account</div>
      <div className="rounded-2xl bg-surface px-4 py-3">
        {step === "closed" && (
          <>
            <button onClick={open} className="text-[15px] text-text">
              Delete my account…
            </button>
            {error && <p className="mt-2 text-sm text-text-soft">{error}</p>}
          </>
        )}

        {step === "loading" && <p className="text-sm text-text-soft">Checking what would be deleted…</p>}

        {step === "confirm" && (
          <div>
            <p className="mb-3 text-sm text-text">This is permanent. There&rsquo;s no undo.</p>
            <ul className="mb-4 list-disc space-y-2 pl-5 text-sm text-text-soft">
              <li>Your profile, ideas, writing activity and collaboration requests are deleted.</li>
              {owned.length > 0 && (
                <li>
                  These stories are yours, so they&rsquo;re deleted for everyone who has access:{" "}
                  <span className="text-text">
                    {owned.map((s, i) => (
                      <span key={s.id}>
                        {i > 0 && ", "}
                        {s.title}
                        {s.otherWriters > 0 && ` (shared with ${s.otherWriters} other ${s.otherWriters === 1 ? "writer" : "writers"})`}
                      </span>
                    ))}
                  </span>
                  . Export anything you want to keep first.
                </li>
              )}
              {(summary?.contributedTo ?? 0) > 0 && (
                <li>
                  Text you wrote in {summary?.contributedTo} {summary?.contributedTo === 1 ? "story" : "stories"} owned by other writers stays in{" "}
                  {summary?.contributedTo === 1 ? "that story" : "those stories"}.
                </li>
              )}
            </ul>

            <label className="mb-1.5 block text-xs uppercase tracking-[0.08em] text-text-soft" htmlFor="delete-password">
              Enter your password to confirm
            </label>
            <input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              className="w-full rounded-xl border border-divider bg-transparent px-3 py-2.5 text-base text-text outline-none focus-visible:border-text"
            />
            {error && <p className="mt-2 text-sm text-text">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep("closed")} disabled={busy} className="flex-1 rounded-lg bg-active py-2.5 text-sm text-text disabled:opacity-60">
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={!password || busy}
                className="flex-1 rounded-lg bg-strong py-2.5 text-sm font-semibold text-on-strong disabled:opacity-40"
              >
                {busy ? "Deleting…" : "Delete my account"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div>
            <p className="text-sm text-text">Your account has been deleted.</p>
            {leftovers > 0 && (
              <p className="mt-2 text-sm text-text-soft">
                Some story text may take a little longer to disappear from our editing service. We&rsquo;ll finish removing it within 30 days.
              </p>
            )}
            <button
              onClick={() => (window.location.href = "/login")}
              className="mt-4 w-full rounded-lg bg-strong py-2.5 text-sm font-semibold text-on-strong"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
