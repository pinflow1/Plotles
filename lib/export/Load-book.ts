import * as Y from "yjs";
import { prisma } from "@/lib/prisma";
import { getLiveblocksClient } from "@/lib/liveblocks";
import { ANONYMOUS_MODES } from "@/lib/anonymous";
import type { Book, ExportChapter } from "./book";
import { blocksFromFragment } from "./yjs-blocks";

// Why an export couldn't be made, in words that can be shown to the writer.
export class ExportError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type YjsReader = { getYjsDocumentAsBinaryUpdate?: (roomId: string) => Promise<ArrayBuffer | Uint8Array> };

function statusOf(err: unknown): number | null {
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === "number" ? s : null;
}

// The chapters' text lives in Liveblocks, not in our database: one room per
// story, one Yjs field per chapter id. Returns null when the room doesn't
// exist yet, i.e. nobody has opened the story in the editor.
async function readRoom(roomId: string): Promise<Uint8Array | null> {
  try {
    const reader = getLiveblocksClient() as unknown as YjsReader;
    if (typeof reader.getYjsDocumentAsBinaryUpdate === "function") {
      return new Uint8Array(await reader.getYjsDocumentAsBinaryUpdate(roomId));
    }
    // An older SDK without that call: ask Liveblocks' REST API directly.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`https://api.liveblocks.io/v2/rooms/${encodeURIComponent(roomId)}/ydoc-binary`, {
        headers: { Authorization: `Bearer ${process.env.LIVEBLOCKS_SECRET_KEY}` },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) throw Object.assign(new Error(`Liveblocks answered ${res.status}`), { status: res.status });
      return new Uint8Array(await res.arrayBuffer());
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    if (statusOf(err) === 404) return null;
    console.error("Export: couldn't read the story from Liveblocks:", err);
    const code = statusOf(err);
    throw new ExportError(`Couldn't read the story from the collaboration server${code ? ` (${code})` : ""}. Try again in a moment.`, 502);
  }
}

// Who goes on the title page. Anonymous stories credit only the person
// exporting, so nobody's pen name leaks through a file.
export function pickAuthors(
  mode: string,
  me: string,
  access: { role: string; isAnonymous: boolean; user: { penName: string } }[]
): string[] {
  if (ANONYMOUS_MODES.includes(mode)) return [me];
  const names: string[] = [];
  const ownerFirst = [...access].sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));
  for (const a of ownerFirst) {
    if ((a.role === "owner" || a.role === "edit") && !a.isAnonymous && !names.includes(a.user.penName)) names.push(a.user.penName);
  }
  return (names.length ? names : [me]).slice(0, 6);
}

export async function loadBook(projectId: string, userId: string): Promise<Book> {
  const [project, me, access] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        title: true,
        coverUrl: true,
        collaborationMode: true,
        chapters: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true, wordCount: true } },
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { penName: true } }),
    prisma.projectAccess.findMany({
      where: { projectId },
      select: { role: true, isAnonymous: true, user: { select: { penName: true } } },
    }),
  ]);
  if (!project || !me) throw new ExportError("Story not found.", 404);

  const doc = new Y.Doc();
  const update = await readRoom(`project:${projectId}`);
  if (update) {
    try {
      Y.applyUpdate(doc, update);
    } catch (err) {
      console.error("Export: couldn't decode the story's document:", err);
      throw new ExportError("Couldn't read the story text.", 500);
    }
  }

  // Noted before reading, because asking for a chapter's field creates it (empty).
  const fieldsFound = Array.from(doc.share.keys()).slice(0, 5).join(", ") || "none";

  const chapters: ExportChapter[] = [];
  for (const c of project.chapters) {
    let blocks: ExportChapter["blocks"] = [];
    try {
      blocks = blocksFromFragment(doc.getXmlFragment(c.id));
    } catch (err) {
      console.error(`Export: couldn't read chapter ${c.id}:`, err);
    }
    // A chapter with nothing in it isn't worth a blank page.
    if (blocks.length) chapters.push({ id: c.id, title: c.title, blocks });
  }

  if (chapters.length === 0) {
    const savedWords = project.chapters.reduce((sum, c) => sum + c.wordCount, 0);
    if (savedWords > 0) {
      throw new ExportError(`Couldn't read the chapter text from the server. (Text fields found: ${fieldsFound}.)`, 502);
    }
    throw new ExportError("There's nothing to export yet. Write something first.", 422);
  }

  return {
    title: project.title,
    authors: pickAuthors(project.collaborationMode, me.penName, access),
    coverUrl: project.coverUrl,
    chapters,
  };
}
