import { createHash } from "crypto";
import { authorsLine, escapeXml, type Block, type Book, type Run } from "./book";
import { makeZip, type ZipEntry } from "./zip";

// An EPUB 3 e-book built by hand: a ZIP with a fixed layout (mimetype,
// container.xml, a package file listing every page, a table of contents and
// one XHTML page per chapter), with an EPUB 2 contents file as well so older
// readers cope.

const XML = '<?xml version="1.0" encoding="UTF-8"?>\n';

function inline(runs: Run[]): string {
  return runs
    .map((run) => {
      if ("lineBreak" in run) return "<br/>";
      let html = escapeXml(run.text);
      if (run.marks.includes("code")) html = `<code>${html}</code>`;
      if (run.marks.includes("strike")) html = `<del>${html}</del>`;
      if (run.marks.includes("underline")) html = `<span class="u">${html}</span>`;
      if (run.marks.includes("italic")) html = `<em>${html}</em>`;
      if (run.marks.includes("bold")) html = `<strong>${html}</strong>`;
      return html;
    })
    .join("");
}

function blockHtml(block: Block): string {
  if (block.kind === "rule") return '<p class="scene">* * *</p>';
  const body = inline(block.runs);
  const cls = block.align ? ` class="${block.align}"` : "";
  switch (block.style) {
    // The chapter's own title is the page's <h1>, so the author's headings start at <h2>.
    case "h1":
      return `<h2${cls}>${body}</h2>`;
    case "h2":
      return `<h3${cls}>${body}</h3>`;
    case "h3":
      return `<h4${cls}>${body}</h4>`;
    case "quote":
      return `<blockquote style="margin-left: ${Math.max(1, block.depth) * 1.5}em"><p>${body}</p></blockquote>`;
    case "code":
      return `<pre><code>${body}</code></pre>`;
    case "bullet":
    case "number": {
      const marker = block.style === "number" ? `${block.number ?? 1}.` : block.depth > 1 ? "–" : "•";
      return `<p class="item" style="margin-left: ${Math.max(1, block.depth) * 1.5}em">${marker}&#160;${body}</p>`;
    }
    default:
      return `<p${cls}${block.depth ? ` style="margin-left: ${block.depth * 1.5}em"` : ""}>${body}</p>`;
  }
}

const page = (title: string, body: string, extraClass = "") =>
  `${XML}<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">` +
  `<head><meta charset="utf-8"/><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>` +
  `<body${extraClass ? ` class="${extraClass}"` : ""}>${body}</body></html>`;

const CSS = `body { font-family: Georgia, "Times New Roman", serif; line-height: 1.5; margin: 0 5%; }
h1 { text-align: center; font-size: 1.6em; margin: 3em 0 1.5em; }
h2, h3, h4 { margin: 1.6em 0 0.6em; }
p { margin: 0; text-indent: 1.3em; }
h1 + p, h2 + p, h3 + p, h4 + p, .scene + p, blockquote + p, pre + p { text-indent: 0; }
p.item, p.center, p.right, p.scene { text-indent: 0; }
.center, .scene { text-align: center; }
.right { text-align: right; }
.justify { text-align: justify; }
.scene { margin: 1.5em 0; }
blockquote { margin: 1em 0; font-style: italic; }
blockquote p { text-indent: 0; }
pre { white-space: pre-wrap; font-size: 0.9em; margin: 1em 0; }
.u { text-decoration: underline; }
.title-page { text-align: center; }
.title-page h1 { margin-top: 30%; font-size: 2.2em; }
.title-page p { text-indent: 0; font-size: 1.2em; }
.cover { text-align: center; margin: 0; }
.cover img { max-width: 100%; max-height: 100%; }
`;

// A stable id for the book, so it stays the same book in a reader across exports.
function bookId(book: Book): string {
  const h = createHash("sha1").update(`${book.title}\n${book.authors.join(",")}`).digest("hex");
  return `urn:uuid:${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function coverImage(coverUrl: string | null): { ext: string; type: string; data: Uint8Array } | null {
  const m = /^data:image\/(jpeg|png|gif);base64,([A-Za-z0-9+/=\s]+)$/.exec(coverUrl ?? "");
  if (!m) return null;
  return { ext: m[1] === "jpeg" ? "jpg" : m[1], type: `image/${m[1]}`, data: Buffer.from(m[2], "base64") };
}

export function buildEpub(book: Book): Uint8Array {
  const cover = coverImage(book.coverUrl);
  const creators = book.authors.length ? book.authors : ["Plotless"];
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  const chapterFiles = book.chapters.map((c, i) => ({
    id: `ch${i + 1}`,
    href: `chapter-${String(i + 1).padStart(3, "0")}.xhtml`,
    title: c.title,
    html: page(c.title, `<h1>${escapeXml(c.title)}</h1>\n${c.blocks.map(blockHtml).join("\n")}`),
  }));

  const entries: ZipEntry[] = [
    { name: "mimetype", data: "application/epub+zip", store: true },
    {
      name: "META-INF/container.xml",
      data: `${XML}<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
    },
    { name: "OEBPS/style.css", data: CSS },
    {
      name: "OEBPS/title.xhtml",
      data: page(book.title, `<h1>${escapeXml(book.title)}</h1>${book.authors.length ? `\n<p>by ${escapeXml(authorsLine(book.authors))}</p>` : ""}`, "title-page"),
    },
  ];

  if (cover) {
    entries.push(
      { name: `OEBPS/cover.${cover.ext}`, data: cover.data },
      { name: "OEBPS/cover.xhtml", data: page(book.title, `<div class="cover"><img src="cover.${cover.ext}" alt="Cover of ${escapeXml(book.title)}"/></div>`) }
    );
  }
  for (const c of chapterFiles) entries.push({ name: `OEBPS/${c.href}`, data: c.html });

  const toc = [{ href: "title.xhtml", title: book.title }, ...chapterFiles.map((c) => ({ href: c.href, title: c.title }))];
  entries.push(
    {
      name: "OEBPS/nav.xhtml",
      data: page(
        "Contents",
        `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${toc.map((t) => `<li><a href="${t.href}">${escapeXml(t.title)}</a></li>`).join("")}</ol></nav>`
      ),
    },
    {
      name: "OEBPS/toc.ncx",
      data:
        `${XML}<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${bookId(book)}"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>` +
        `<docTitle><text>${escapeXml(book.title)}</text></docTitle><navMap>` +
        toc.map((t, i) => `<navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${escapeXml(t.title)}</text></navLabel><content src="${t.href}"/></navPoint>`).join("") +
        "</navMap></ncx>",
    },
    {
      name: "OEBPS/content.opf",
      data:
        `${XML}<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="en"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">` +
        `<dc:identifier id="bookid">${bookId(book)}</dc:identifier><dc:title>${escapeXml(book.title)}</dc:title>` +
        creators.map((a) => `<dc:creator>${escapeXml(a)}</dc:creator>`).join("") +
        `<dc:language>en</dc:language><meta property="dcterms:modified">${modified}</meta>${cover ? '<meta name="cover" content="cover-image"/>' : ""}</metadata><manifest>` +
        '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="css" href="style.css" media-type="text/css"/>' +
        (cover ? `<item id="cover-image" href="cover.${cover.ext}" media-type="${cover.type}" properties="cover-image"/><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>` : "") +
        '<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>' +
        chapterFiles.map((c) => `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`).join("") +
        `</manifest><spine toc="ncx">${cover ? '<itemref idref="cover"/>' : ""}<itemref idref="title"/>${chapterFiles.map((c) => `<itemref idref="${c.id}"/>`).join("")}</spine></package>`,
    }
  );

  return makeZip(entries);
              }
      
