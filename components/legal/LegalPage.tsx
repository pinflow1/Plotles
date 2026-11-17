import Link from "next/link";
import type { ReactNode } from "react";

// One place for the contact address and the "last updated" date, so a change
// shows up on every legal page (and in Settings) at once.
export const SUPPORT_EMAIL = "edgepro63@gmail.com";
export const LEGAL_UPDATED = "November 15, 2026";

const linkClass = "text-text underline underline-offset-2";

export function SupportLink() {
  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>
      {SUPPORT_EMAIL}
    </a>
  );
}

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="font-serif text-xl text-text">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

// The shared page for Terms, Privacy and any later legal pages: public (no
// sign-in needed), plain and readable on a phone.
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-paper px-6 pb-20 pt-[max(2rem,env(safe-area-inset-top))]">
      <article className="mx-auto max-w-prose text-[15px] leading-relaxed text-text">
        <Link href="/" className="text-xs font-bold tracking-[0.16em] text-text">
          PLOTLESS
        </Link>
        <h1 className="mt-8 font-serif text-3xl text-text">{title}</h1>
        <p className="mt-2 text-sm text-text-soft">Last updated {LEGAL_UPDATED}</p>

        <div className="mt-8 space-y-9">{children}</div>

        <footer className="mt-14 border-t border-divider pt-6 text-sm text-text-soft">
          <Link href="/terms" className={linkClass}>
            Terms of Use
          </Link>
          {" · "}
          <Link href="/privacy" className={linkClass}>
            Privacy Policy
          </Link>
          {" · "}
          <SupportLink />
        </footer>
      </article>
    </main>
  );
}
