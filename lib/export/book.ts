// What every export format works from: a book is a title, its authors and
// a list of chapters, and each chapter is a flat list of blocks. The editor's
// nested document (lists inside quotes, and so on) is flattened on the way
// in (see yjs-blocks.ts) so each format only has to draw simple blocks.

export type Mark = "bold" | "italic" | "underline" | "strike" | "code";
export type Run = { text: string; marks: Mark[] } | { lineBreak: true };
export type Align = "center" | "right" | "justify";
export type BlockStyle = "p" | "h1" | "h2" | "h3" | "quote" | "code" | "bullet" | "number";

export type Block =
  | {
      kind: "text";
      style: BlockStyle;
      align: Align | null;
      // Indent level: list nesting, or how deep inside a quote.
      depth: number;
      // The 1, 2, 3… of a numbered list item.
      number: number | null;
      runs: Run[];
    }
  | { kind: "rule" };

export type ExportChapter = { id: string; title: string; blocks: Block[] };
export type Book = { title: string; authors: string[]; coverUrl: string | null; chapters: ExportChapter[] };

// XML 1.0 can't carry most control characters or lone surrogates; one stray
// character from a paste would make Word or an e-reader refuse the file.
export function cleanText(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x0d) {
      if (s.charCodeAt(i + 1) !== 0x0a) out += "\n";
      continue;
    }
    if (c < 0x20 && c !== 0x09 && c !== 0x0a) continue;
    if (c === 0xfffe || c === 0xffff) continue;
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += s[i] + s[i + 1];
        i++;
      }
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue;
    out += s[i];
  }
  return out;
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function safeFileName(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
  return cleaned || "Plotless story";
}

// A plain-ASCII filename for old clients plus the UTF-8 one for everyone else,
// so a title in any language downloads under its own name.
export function contentDisposition(name: string, ext: string): string {
  const full = `${name}.${ext}`;
  const ascii = full.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const utf8 = encodeURIComponent(full).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

// "A", "A & B", "A, B & C".
export function authorsLine(authors: string[]): string {
  if (authors.length <= 1) return authors[0] ?? "";
  return `${authors.slice(0, -1).join(", ")} & ${authors[authors.length - 1]}`;
}

export function runsToText(runs: Run[]): string {
  return runs.map((r) => ("lineBreak" in r ? "\n" : r.text)).join("");
}

export function isBlank(block: Block): boolean {
  return block.kind === "text" && runsToText(block.runs).trim() === "";
}

export function bookToText(book: Book): string {
  const out: string[] = [book.title];
  if (book.authors.length) out.push(`by ${authorsLine(book.authors)}`);

  for (const chapter of book.chapters) {
    out.push("", "", chapter.title, "");
    let lastList: BlockStyle | null = null;
    let afterBlank = true;
    for (const block of chapter.blocks) {
      const listStyle = block.kind === "text" && (block.style === "bullet" || block.style === "number") ? block.style : null;
      const isList = listStyle !== null;
      // A blank line when a list ends, or when a numbered list follows a bulleted one (or the reverse).
      if (lastList && (!isList || (block.kind === "text" && block.depth <= 1 && listStyle !== lastList))) out.push("");
      lastList = null;

      if (block.kind === "rule") {
        out.push("* * *", "");
        afterBlank = true;
        continue;
      }
      const text = runsToText(block.runs);
      if (text.trim() === "") {
        if (!afterBlank) out.push("");
        afterBlank = true;
        continue;
      }
      const indent = "  ".repeat(Math.max(0, block.depth - 1));
      let line = text;
      if (block.style === "bullet") line = `${indent}- ${text}`;
      else if (block.style === "number") line = `${indent}${block.number ?? 1}. ${text}`;
      else if (block.style === "quote") line = text.split("\n").map((l) => `> ${l}`).join("\n");
      else if (block.style === "code") line = text.split("\n").map((l) => `    ${l}`).join("\n");
      out.push(line);
      // List items stay together; anything else is a paragraph with a blank line after it.
      if (isList) lastList = listStyle;
      else out.push("");
      afterBlank = !isList;
    }
  }
  return out.join("\n").replace(/\n{4,}/g, "\n\n\n").trim() + "\n";
}
