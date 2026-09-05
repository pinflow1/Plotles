"use client";

import { createContext, useContext, useRef, useState } from "react";

type ChapterSession = { scrollTop?: number; selection?: { from: number; to: number } };
export type CurrentLocation = {
  projectId: string;
  projectTitle: string;
  chapterId: string;
  chapterTitle: string;
  role: "owner" | "edit" | "view";
};

type SessionCacheValue = {
  get: (chapterId: string) => ChapterSession | undefined;
  set: (chapterId: string, patch: ChapterSession) => void;
  /** Where the editor last was — read by the nav drawer so "Current Chapter"
   *  and the project/chapter indicator work from Dashboard or Settings too. */
  current: CurrentLocation | null;
  setCurrent: (loc: CurrentLocation) => void;
};

const SessionCacheContext = createContext<SessionCacheValue | null>(null);

/**
 * Mounted once in the root layout, which Next.js does not remount on
 * client-side navigation — so this survives even though the editor
 * page itself unmounts when you visit Dashboard or Settings and come back.
 */
export function SessionCacheProvider({ children }: { children: React.ReactNode }) {
  const store = useRef(new Map<string, ChapterSession>());
  const [current, setCurrent] = useState<CurrentLocation | null>(null);

  const value: SessionCacheValue = {
    get: (chapterId) => store.current.get(chapterId),
    set: (chapterId, patch) => {
      store.current.set(chapterId, { ...store.current.get(chapterId), ...patch });
    },
    current,
    setCurrent,
  };

  return <SessionCacheContext.Provider value={value}>{children}</SessionCacheContext.Provider>;
}

export function useSessionCache() {
  const ctx = useContext(SessionCacheContext);
  if (!ctx) throw new Error("useSessionCache must be used within SessionCacheProvider");
  return ctx;
}
