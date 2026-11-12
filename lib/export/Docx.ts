import { authorsLine, escapeXml, type Align, type Block, type Book, type Run } from "./book";
import { makeZip } from "./zip";

// A Word document built by hand: a .docx is a ZIP of a few XML files. The
// look is a plain manuscript — Times 12, 1.5 line spacing, indented
// paragraphs, one chapter per page, page numbers in the footer.

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS = `xmlns:w="${W}" xmlns:r="${R}"`;

function runXml(run: Run): string {
  if ("lineBreak" in run) return "<w:r><w:br/></w:r>";
  const props: string[] = [];
  if (run.marks.includes("code")) props.push('<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>');
  if (run.marks.includes("bold")) props.push("<w:b/><w:bCs/>");
  if (run.marks.includes("italic")) props.push("<w:i/><w:iCs/>");
  if (run.marks.includes("strike")) props.push("<w:strike/>");
  if (run.marks.includes("underline")) props.push('<w:u w:val="single"/>');
  const rPr = props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
  // A typed tab becomes a real Word tab.
  return run.text
    .split("\t")
    .map((part, i) => (i > 0 ? `<w:r>${rPr}<w:tab/></w:r>` : "") + (part ? `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>` : ""))
    .join("");
}

const plain = (text: string): string => runXml({ text, marks: [] });

function para(style: string, content: string, o: { align?: Align | null; left?: number; right?: number; hanging?: number } = {}): string {
  const jc = o.align ? `<w:jc w:val="${o.align === "justify" ? "both" : o.align}"/>` : "";
  const ind =
    o.left || o.right || o.hanging
      ? `<w:ind w:left="${o.left ?? 0}"${o.right ? ` w:right="${o.right}"` : ""}${o.hanging ? ` w:hanging="${o.hanging}"` : ""}/>`
      : "";
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${ind}${jc}</w:pPr>${content}</w:p>`;
}

const INDENT = 720; // half an inch, in twentieths of a point

function blockXml(block: Block, first: boolean): string {
  if (block.kind === "rule") return para("PlotlessScene", plain("* * *"));
  const body = block.runs.map(runXml).join("");
  switch (block.style) {
    case "h1":
    case "h2":
      return para("Heading2", body, { align: block.align });
    case "h3":
      return para("Heading3", body, { align: block.align });
    case "quote":
      return para("Quote", body, { align: block.align, left: INDENT * Math.max(1, block.depth), right: INDENT });
    case "code":
      return para("PlotlessCode", body, { left: INDENT * Math.max(0, block.depth) });
    case "bullet":
    case "number": {
      const marker = block.style === "number" ? `${block.number ?? 1}.` : block.depth > 1 ? "–" : "•";
      return para("PlotlessList", `${plain(marker)}<w:r><w:tab/></w:r>${body}`, { left: INDENT * Math.max(1, block.depth), hanging: 360 });
    }
    default:
      return para(first ? "PlotlessBodyFirst" : "PlotlessBody", body, { align: block.align, left: block.depth * INDENT });
  }
}

function documentXml(book: Book): string {
  const body: string[] = [para("Title", plain(book.title))];
  if (book.authors.length) body.push(para("Subtitle", plain(`by ${authorsLine(book.authors)}`)));

  for (const chapter of book.chapters) {
    body.push(para("Heading1", plain(chapter.title)));
    // The first paragraph after a heading or a scene break isn't indented, as in a printed book.
    let first = true;
    for (const block of chapter.blocks) {
      body.push(blockXml(block, first));
      first = block.kind === "rule" || (block.kind === "text" && /^h[123]$/.test(block.style));
    }
  }

  const sect =
    '<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:footerReference w:type="first" r:id="rId3"/>' +
    '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="709" w:footer="709" w:gutter="0"/><w:titlePg/></w:sectPr>';
  return `${XML}<w:document ${NS}><w:body>${body.join("")}${sect}</w:body></w:document>`;
}

function style(id: string, name: string, o: { based?: string; next?: string; ppr?: string; rpr?: string; q?: boolean } = {}): string {
  return (
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>` +
    (o.based ? `<w:basedOn w:val="${o.based}"/>` : "") +
    (o.next ? `<w:next w:val="${o.next}"/>` : "") +
    (o.q === false ? "" : "<w:qFormat/>") +
    (o.ppr ? `<w:pPr>${o.ppr}</w:pPr>` : "") +
    (o.rpr ? `<w:rPr>${o.rpr}</w:rPr>` : "") +
    "</w:style>"
  );
}

function stylesXml(): string {
  const fonts = (f: string) => `<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:eastAsia="${f}" w:cs="${f}"/>`;
  return (
    `${XML}<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr>${fonts("Times New Roman")}<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault>` +
    '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    style("Title", "Title", { based: "Normal", next: "Normal", ppr: '<w:spacing w:before="3600" w:after="360"/><w:jc w:val="center"/>', rpr: '<w:b/><w:sz w:val="56"/><w:szCs w:val="56"/>' }) +
    style("Subtitle", "Subtitle", { based: "Normal", next: "Normal", ppr: '<w:jc w:val="center"/>', rpr: '<w:sz w:val="28"/><w:szCs w:val="28"/>' }) +
    style("Heading1", "heading 1", { based: "Normal", next: "PlotlessBodyFirst", ppr: '<w:keepNext/><w:keepLines/><w:pageBreakBefore/><w:spacing w:before="2400" w:after="720"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/>', rpr: '<w:b/><w:sz w:val="36"/><w:szCs w:val="36"/>' }) +
    style("Heading2", "heading 2", { based: "Normal", next: "PlotlessBodyFirst", ppr: '<w:keepNext/><w:keepLines/><w:spacing w:before="480" w:after="240"/><w:outlineLvl w:val="1"/>', rpr: '<w:b/><w:sz w:val="28"/><w:szCs w:val="28"/>' }) +
    style("Heading3", "heading 3", { based: "Normal", next: "PlotlessBodyFirst", ppr: '<w:keepNext/><w:keepLines/><w:spacing w:before="360" w:after="180"/><w:outlineLvl w:val="2"/>', rpr: "<w:b/><w:i/>" }) +
    style("PlotlessBody", "Plotless Body", { based: "Normal", ppr: '<w:spacing w:line="360" w:lineRule="auto"/><w:ind w:firstLine="720"/>' }) +
    style("PlotlessBodyFirst", "Plotless Body First", { based: "PlotlessBody", ppr: '<w:ind w:firstLine="0"/>' }) +
    style("Quote", "Quote", { based: "Normal", next: "PlotlessBody", ppr: '<w:spacing w:before="120" w:after="120" w:line="360" w:lineRule="auto"/>' }) +
    style("PlotlessCode", "Plotless Code", { based: "Normal", ppr: '<w:spacing w:before="120" w:after="120"/>', rpr: `${fonts("Courier New")}<w:sz w:val="20"/><w:szCs w:val="20"/>` }) +
    style("PlotlessList", "Plotless List", { based: "Normal", ppr: '<w:spacing w:line="360" w:lineRule="auto"/>' }) +
    style("PlotlessScene", "Plotless Scene Break", { based: "Normal", next: "PlotlessBodyFirst", ppr: '<w:spacing w:before="360" w:after="360"/><w:jc w:val="center"/>' }) +
    style("Footer", "footer", { based: "Normal", q: false, ppr: '<w:jc w:val="center"/>' }) +
    "</w:styles>"
  );
}

const footerXml = (content: string) => `${XML}<w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr>${content}</w:p></w:ftr>`;
const PAGE_NUMBER =
  '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
  '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';

const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const rels = (items: [string, string, string][]) =>
  `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  items.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`).join("") +
  "</Relationships>";

export function buildDocx(book: Book): Uint8Array {
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const wml = "application/vnd.openxmlformats-officedocument.wordprocessingml";
  const override = (part: string, type: string) => `<Override PartName="${part}" ContentType="${type}"/>`;

  return makeZip([
    {
      name: "[Content_Types].xml",
      data:
        `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        override("/word/document.xml", `${wml}.document.main+xml`) +
        override("/word/styles.xml", `${wml}.styles+xml`) +
        override("/word/footer1.xml", `${wml}.footer+xml`) +
        override("/word/footer2.xml", `${wml}.footer+xml`) +
        override("/docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml") +
        override("/docProps/app.xml", "application/vnd.openxmlformats-officedocument.extended-properties+xml") +
        "</Types>",
    },
    {
      name: "_rels/.rels",
      data: rels([
        ["rId1", `${REL}/officeDocument`, "word/document.xml"],
        ["rId2", "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", "docProps/core.xml"],
        ["rId3", `${REL}/extended-properties`, "docProps/app.xml"],
      ]),
    },
    {
      name: "docProps/core.xml",
      data:
        `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
        `<dc:title>${escapeXml(book.title)}</dc:title><dc:creator>${escapeXml(authorsLine(book.authors) || "Plotless")}</dc:creator>` +
        `<dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified></cp:coreProperties>`,
    },
    {
      name: "docProps/app.xml",
      data: `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Plotless</Application></Properties>`,
    },
    { name: "word/document.xml", data: documentXml(book) },
    { name: "word/styles.xml", data: stylesXml() },
    { name: "word/footer1.xml", data: footerXml(PAGE_NUMBER) },
    { name: "word/footer2.xml", data: footerXml("") },
    {
      name: "word/_rels/document.xml.rels",
      data: rels([
        ["rId1", `${REL}/styles`, "styles.xml"],
        ["rId2", `${REL}/footer`, "footer1.xml"],
        ["rId3", `${REL}/footer`, "footer2.xml"],
      ]),
    },
  ]);
}
