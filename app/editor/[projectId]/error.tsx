"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EditorError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error("Editor route crashed:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#111111] px-6 text-center text-[#D8D2C4]">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#8E8E8E]">Something went wrong</p>
      <p className="max-w-sm text-sm">{error.message || "No error message was provided — check Vercel's Runtime Logs for the full detail."}</p>
      {error.digest && <p className="text-xs text-[#8E8E8E]">Digest: {error.digest}</p>}
      <div className="mt-2 flex gap-3">
        <button onClick={() => reset()} className="rounded-xl bg-[#242424] px-4 py-2 text-sm">
          Try again
        </button>
        <button onClick={() => router.push("/dashboard")} className="rounded-xl border border-[#8E8E8E]/40 px-4 py-2 text-sm">
          Back to Dashboard
        </button>
      </div>
    </main>
  );
}
