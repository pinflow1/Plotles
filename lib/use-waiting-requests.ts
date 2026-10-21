import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

// How many requests are waiting on the signed-in user to respond (invites
// sent to them, and writers asking to join their stories). `null` until
// it's known. Only fetches while `active` is true, so a closed menu costs
// nothing; a badge is a nicety, so a failed fetch is silent.
export function useWaitingRequests(active: boolean = true): { waiting: number | null; setWaiting: (n: number) => void } {
  const [waiting, setWaiting] = useState<number | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    api
      .get<{ waiting: number }>("/api/collaboration-requests/count")
      .then((r) => {
        if (!cancelled) setWaiting(r.waiting);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active]);

  return { waiting, setWaiting };
}
