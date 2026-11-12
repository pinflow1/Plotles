"use client";

import { Fragment, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { authorsLine, type Block, type Run } from "@/lib/export/book";

export type PrintableBook = {
  title: string;
  authors: string[];
  chapters: { id: string; title: string; blocks: Block[] }[];
};

// The book laid out for the printer. It sits in its own container on the page,
// invisible on screen; when the phone's print screen opens, everything else is
// hidden and only this prints. "Save as PDF" in that screen makes the PDF.
const CSS = `
@page { margin: 22mm 20mm; }
@media screen { #print-root { display: none; } }
@media print {
  html, body { background: #fff !important; color: #000 !important; }
  body > *:not(#print-root) { display: none !important; }
  #print-root { display: block; }
}
#print-root { color: #000; background: #fff; font-family: Georgia, "Times New Roman", serif; font-size: 12pt; line-height: 1.5; }
#print-root .pb-title { text-align: center; padding-top: 9cm; break-after: page; page-break-after: always; }
#print-root .pb-title h1 { font-size: 30pt; font-weight: 700; margin: 0 0 0.6cm; }
#print-root .pb-title p { font-size: 14pt; margin: 0; text-indent: 0; }
#print-root .pb-chapter { break-before: page; page-break-before: always; }
#print-root .pb-chapter > h2 { text-align: center; font-size: 18pt; font-weight: 700; margin: 3cm 0 1.2cm; break-after: avoid; }
#print-root h3, #print-root h4, #print-root h5 { font-size: 12pt; font-weight: 700; margin: 1.2em 0 0.5em; break-after: avoid; }
#print-root h3 { font-size: 14pt; }
#print-root h5 { font-style: italic; }
#print-root p { margin: 0; text-indent: 1.2em; orphans: 3; widows: 3; }
#print-root h2 + p, #print-root h3 + p, #print-root h4 + p, #print-root h5 + p, #print-root .scene + p { text-indent: 0; }
#print-root p.item, #print-root p.scene, #print-root p.center, #print-root p.right { text-indent: 0; }
#print-root .center, #print-root .scene { text-align: center; }
#print-root .right { text-align: right; }
#print-root .justify { text-align: justify; }
#print-root .scene { margin: 1.2em 0; }
#print-root blockquote { margin: 0.8em 0; }
#print-root blockquote p { text-indent: 0; }
#print-root pre { white-space: pre-wrap; font-size: 10pt; margin: 0.8em 0; }
`;

function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((run, i) => {
        if ("lineBreak" in run) return <br key={i} />;
        let node: ReactNode = run.text;
        if (run.marks.includes("code")) node = <code>{node}</code>;
        if (run.marks.includes("strike")) node = <s>{node}</s>;
        if (run.marks.includes("underline")) node = <u>{node}</u>;
        if (run.marks.includes("italic")) node = <em>{node}</em>;
        if (run.marks.includes("bold")) node = <strong>{node}</strong>;
        return <Fragment key={i}>{node}</Fragment>;
      })}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  if (block.kind === "rule") return <p className="scene">* * *</p>;
  const cls = block.align ?? undefined;
  const indent = { marginLeft: `${Math.max(1, block.depth) * 1.5}em` };
  const body = <Runs runs={block.runs} />;
  switch (block.style) {
    // The chapter's title is the <h2>, so the author's headings start at <h3>.
    case "h1":
      return <h3 className={cls}>{body}</h3>;
    case "h2":
      return <h4 className={cls}>{body}</h4>;
    case "h3":
      return <h5 className={cls}>{body}</h5>;
    case "quote":
      return (
        <blockquote style={indent}>
          <p>{body}</p>
        </blockquote>
      );
    case "code":
      return (
        <pre>
          <code>{body}</code>
        </pre>
      );
    case "bullet":
    case "number":
      return (
        <p className="item" style={indent}>
          {block.style === "number" ? `${block.number ?? 1}.` : block.depth > 1 ? "–" : "•"}&nbsp;{body}
        </p>
      );
    default:
      return (
        <p className={cls} style={block.depth ? indent : undefined}>
          {body}
        </p>
      );
  }
}

export function PrintBook({ book }: { book: PrintableBook }) {
  return createPortal(
    <div id="print-root">
      <style>{CSS}</style>
      <section className="pb-title">
        <h1>{book.title}</h1>
        {book.authors.length > 0 && <p>by {authorsLine(book.authors)}</p>}
      </section>
      {book.chapters.map((chapter) => (
        <section key={chapter.id} className="pb-chapter">
          <h2>{chapter.title}</h2>
          {chapter.blocks.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}
        </section>
      ))}
    </div>,
    document.body
  );
          }
