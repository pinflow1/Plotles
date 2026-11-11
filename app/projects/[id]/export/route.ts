import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { canEdit, getProjectRole } from "@/lib/access";
import { ExportError, loadBook } from "@/lib/export/load-book";
import { bookToText, contentDisposition, safeFileName } from "@/lib/export/book";
import { buildDocx } from "@/lib/export/docx";
import { buildEpub } from "@/lib/export/epub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FILES = {
  docx: { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" },
  epub: { type: "application/epub+zip", ext: "epub" },
  txt: { type: "text/plain; charset=utf-8", ext: "txt" },
} as const;

// GET /api/projects/<id>/export?format=docx | epub | txt  -> the file
//                                      format=book         -> the book as JSON (the PDF / print view draws it)
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // The story id is read from the URL itself (/api/projects/<id>/export), so
  // a mistyped folder name can't break it.
  const projectId = req.nextUrl.pathname.split("/")[3] ?? "";
  const role = projectId ? await getProjectRole(userId, projectId) : null;
  if (!role) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // Exporting hands over the whole manuscript, so it's for the owner and editors.
  if (!canEdit(role)) return NextResponse.json({ error: "Only the owner and editors can export this story." }, { status: 403 });

  const format = req.nextUrl.searchParams.get("format");
  if (format !== "docx" && format !== "epub" && format !== "txt" && format !== "book") {
    return NextResponse.json({ error: "Unknown format." }, { status: 400 });
  }

  try {
    const book = await loadBook(projectId, userId);

    if (format === "book") {
      const { title, authors, chapters } = book;
      return NextResponse.json({ book: { title, authors, chapters } }, { headers: { "Cache-Control": "no-store" } });
    }

    const file = FILES[format];
    const bytes =
      format === "docx" ? buildDocx(book) : format === "epub" ? buildEpub(book) : new TextEncoder().encode(bookToText(book));

    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": file.type,
        "Content-Disposition": contentDisposition(safeFileName(book.title), file.ext),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof ExportError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("GET /api/projects/[id]/export failed:", err);
    return NextResponse.json({ error: "Couldn't build the export. Try again." }, { status: 500 });
  }
}
