"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlignLeft, BookOpen, ChevronLeft, FileText, Printer } from "lucide-react";
import { formatWordCount } from "@/lib/format";
import { PrintBook, type PrintableBook } from "@/components/projects/PrintBook";

type Format = "docx" | "pdf" | "epub" | "txt";

const FORMATS: { id: Format; title: string; note: string; icon: typeof FileText }[] = [
  { id: "docx", title: "Word document", note: ".docx · to edit, or send to an editor or agent", icon: FileText },
  { id: "pdf", title: "PDF", note: "Opens the print screen — choose Save as PDF", icon: Printer },
  { id: "epub", title: "E-book", note: ".epub · for e-readers and publishing sites", icon: BookOpen },
  { id: "txt", title: "Plain text", note: ".txt · simple, opens anywhere", icon: AlignLeft },
];

// The file name the server chose, from its Content-Disposition header.
function fileNameFrom(header: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      // fall through to the plain name
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain ? plain[1] : null;
}

async function errorFrom(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : `Something went wrong (${res.status}). Please try again.`;
}

export function ExportView({
  project,
}: {
  project: { id: string; title: string; chapterCount: number; wordCount: number; anonymous: boolean };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Format | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [printBook, setPrintBook] = useState<PrintableBook | null>(null);

  // Once the book is laid out on the page, open the print screen.
  useEffect(() => {
    if (!printBook) return;
    const t = setTimeout(() => window.print(), 150);
    return () => clearTimeout(t);
  }, [printBook]);

  async function start(format: Format) {
    if (busy) return;
    setBusy(format);
    setMessage(null);
    try {
      const url = `/api/projects/${project.id}/export?format=${format === "pdf" ? "book" : format}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(await errorFrom(res));

      if (format === "pdf") {
        const { book } = (await res.json()) as { book: PrintableBook };
        setPrintBook(book);
        return;
      }

      const blob = await res.blob();
      const name = fileNameFrom(res.headers.get("Content-Disposition")) ?? `${project.title}.${format}`;
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 15000);
      setMessage(`Downloaded ${name}`);
    } catch (err) {
      // A dropped connection reaches us as a bare TypeError ("Failed to fetch"), which means nothing to a writer.
      setMessage(
        err instanceof TypeError
          ? "Couldn't reach Plotless. Check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Couldn't export that. Try again."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-paper pb-16 pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => router.back()} aria-label="Back" className="rounded-lg p-2.5 text-text active:bg-active">
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <span className="text-xs font-bold tracking-[0.16em] text-text">EXPORT</span>
        <div className="w-10" />
      </header>

      <div className="mx-auto max-w-lg px-5 pt-2">
        <div className="mb-6 rounded-2xl bg-surface p-4">
          <div className="truncate font-serif text-lg text-text">{project.title}</div>
          <div className="mt-0.5 text-sm text-text-soft">
            {project.chapterCount} {project.chapterCount === 1 ? "chapter" : "chapters"} · {formatWordCount(project.wordCount)}
          </div>
        </div>

        <div className="mb-2 px-1 text-xs uppercase tracking-[0.08em] text-text-soft">Download as</div>
        <div className="rounded-2xl bg-surface">
          {FORMATS.map(({ id, title, note, icon: Icon }) => (
            <button
              key={id}
              onClick={() => start(id)}
              disabled={busy !== null}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left first:rounded-t-2xl last:rounded-b-2xl [&:not(:first-child)]:border-t [&:not(:first-child)]:border-divider active:bg-active disabled:opacity-60"
            >
              <Icon size={18} strokeWidth={1.6} className="shrink-0 text-text" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] text-text">{title}</span>
                <span className="mt-0.5 block text-xs text-text-soft">{note}</span>
              </span>
              {busy === id && <span className="text-xs text-text-soft">Preparing…</span>}
            </button>
          ))}
        </div>

        {message && (
          <p role="status" className="mt-4 px-1 text-sm text-text">
            {message}
          </p>
        )}

        <p className="mt-6 px-1 text-xs leading-relaxed text-text-soft">
          Chapters come out in order, with bold, italic, underline and headings kept. The story stays on Plotless too.
          {project.anonymous && " This story is anonymous, so the title page credits only you."}
        </p>
      </div>

      {printBook && <PrintBook book={printBook} />}
    </div>
  );
}
