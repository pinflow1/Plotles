import { cleanText, isBlank, type Align, type Block, type BlockStyle, type Mark, type Run } from "./book";

// Turns one chapter's stored text into flat blocks. The editor (Tiptap) keeps
// each chapter as a Yjs XmlFragment: elements named after the editor's nodes
// (paragraph, heading, bulletList…), with the node's settings as attributes
// and the typed text, bold/italic and so on, in XmlText children.
//
// The Yjs types are read by their shape (nodeName / toArray / getAttributes /
// toDelta) rather than with instanceof, so this file needs no Yjs import and
// can't be tripped up by two copies of the library being loaded.

type YNode = {
  nodeName?: unknown;
  toArray?: () => unknown[];
  getAttributes?: () => Record<string, unknown>;
  toDelta?: () => Array<{ insert?: unknown; attributes?: Record<string, unknown> | null }>;
};
type YElement = YNode & { nodeName: string; toArray: () => unknown[] };
type YText = YNode & { toDelta: NonNullable<YNode["toDelta"]> };

const MARK_ORDER: Mark[] = ["bold", "italic", "underline", "strike", "code"];

function isElement(n: unknown): n is YElement {
  return !!n && typeof (n as YNode).nodeName === "string" && typeof (n as YNode).toArray === "function";
}

function isText(n: unknown): n is YText {
  return !!n && typeof (n as YNode).toDelta === "function";
}

function attrsOf(n: YNode): Record<string, unknown> {
  try {
    return (typeof n.getAttributes === "function" ? n.getAttributes() : null) ?? {};
  } catch {
    return {};
  }
}

// The editor stores a bold run as the attribute `bold`. A mark that can
// overlap itself gets a hash on the end (`link--3fa9`), hence the split.
function marksOf(attributes: Record<string, unknown> | null | undefined): Mark[] {
  const names = Object.keys(attributes ?? {})
    .filter((k) => attributes![k] !== null && attributes![k] !== undefined && attributes![k] !== false)
    .map((k) => k.split("--")[0]);
  return MARK_ORDER.filter((m) => names.includes(m));
}

function textRuns(text: string, marks: Mark[]): Run[] {
  const runs: Run[] = [];
  cleanText(text)
    .split("\n")
    .forEach((part, i) => {
      if (i > 0) runs.push({ lineBreak: true });
      if (part) runs.push({ text: part, marks });
    });
  return runs;
}

function mergeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const run of runs) {
    const last = out[out.length - 1];
    if (last && !("lineBreak" in last) && !("lineBreak" in run) && last.marks.join() === run.marks.join()) {
      out[out.length - 1] = { text: last.text + run.text, marks: last.marks };
    } else {
      out.push(run);
    }
  }
  return out;
}

function inlineRuns(children: unknown[]): Run[] {
  const runs: Run[] = [];
  for (const child of children) {
    if (isText(child)) {
      for (const op of child.toDelta()) {
        if (typeof op.insert === "string") runs.push(...textRuns(op.insert, marksOf(op.attributes)));
      }
    } else if (isElement(child)) {
      if (child.nodeName === "hardBreak") runs.push({ lineBreak: true });
      else runs.push(...inlineRuns(child.toArray()));
    }
  }
  return mergeRuns(runs);
}

function alignOf(attrs: Record<string, unknown>): Align | null {
  const a = attrs.textAlign;
  return a === "center" || a === "right" || a === "justify" ? a : null;
}

type Ctx = { quote: number; listDepth: number };

function textBlock(style: BlockStyle, node: YElement, depth: number, number: number | null = null): Block {
  return { kind: "text", style, align: alignOf(attrsOf(node)), depth, number, runs: inlineRuns(node.toArray()) };
}

function walk(nodes: unknown[], ctx: Ctx, out: Block[]): void {
  for (const node of nodes) {
    if (isText(node)) {
      out.push({ kind: "text", style: "p", align: null, depth: ctx.quote, number: null, runs: inlineRuns([node]) });
      continue;
    }
    if (!isElement(node)) continue;

    switch (node.nodeName) {
      case "paragraph":
        out.push(textBlock(ctx.quote ? "quote" : "p", node, ctx.quote + ctx.listDepth));
        break;
      case "heading": {
        const level = Math.min(3, Math.max(1, Math.round(Number(attrsOf(node).level)) || 1));
        out.push(textBlock(`h${level}` as BlockStyle, node, 0));
        break;
      }
      case "blockquote":
        walk(node.toArray(), { ...ctx, quote: ctx.quote + 1 }, out);
        break;
      case "bulletList":
      case "orderedList": {
        const ordered = node.nodeName === "orderedList";
        const depth = ctx.listDepth + 1;
        let next = Math.round(Number(attrsOf(node).start)) || 1;
        for (const item of node.toArray()) {
          if (!isElement(item)) continue;
          let first = true;
          for (const kid of item.toArray()) {
            if (isElement(kid) && kid.nodeName === "paragraph") {
              out.push(textBlock(first ? (ordered ? "number" : "bullet") : "p", kid, depth, first && ordered ? next : null));
              first = false;
            } else {
              walk([kid], { ...ctx, listDepth: depth }, out);
            }
          }
          next++;
        }
        break;
      }
      case "codeBlock":
        out.push(textBlock("code", node, 0));
        break;
      case "horizontalRule":
        out.push({ kind: "rule" });
        break;
      default:
        // Something this editor doesn't normally produce: keep whatever text it holds.
        walk(node.toArray(), ctx, out);
    }
  }
}

// No blank paragraphs at either end of a chapter, and never more than two in a row.
function tidy(blocks: Block[]): Block[] {
  const out: Block[] = [];
  let blanks = 0;
  for (const block of blocks) {
    if (isBlank(block)) {
      if (out.length === 0 || ++blanks > 2) continue;
    } else {
      blanks = 0;
    }
    out.push(block);
  }
  while (out.length && isBlank(out[out.length - 1])) out.pop();
  return out;
}

export function blocksFromFragment(fragment: { toArray(): unknown[] } | null | undefined): Block[] {
  if (!fragment || typeof fragment.toArray !== "function") return [];
  const out: Block[] = [];
  walk(fragment.toArray(), { quote: 0, listDepth: 0 }, out);
  return tidy(out);
            }
       
