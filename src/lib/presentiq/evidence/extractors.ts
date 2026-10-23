/**
 * File extractors.
 *
 * MVP-first: native parsers for plain text + CSV + best-effort PDF/PPTX/DOCX
 * via dynamic imports of optional dependencies.
 *
 * The intent is that this layer is replaceable without changing the
 * Evidence Agent contract.
 */

import { sanitiseForAgent } from "../security/guardrail";

export type ExtractedDoc = {
  fileId: string;
  status: "extracted" | "empty" | "unsupported" | "failed";
  warnings: string[];
  text: string;
  pages?: { number: number; text: string }[];
  tables?: { page: number; rows: string[][] }[];
  numbers?: { value: number; unit?: string; page?: number }[];
  dates?: { iso: string; page?: number }[];
};

// The grouped branch requires at least one separator group (`+`, not `*`).
// With `*` it matched the first one-to-three digits of any plain number and
// won, because alternation is leftmost-first rather than longest: 12400000
// came out as 124, and -5000 as -500. Spreadsheet cells store raw numbers
// without thousands separators, so every value above 999 was being truncated
// to its first three digits before anything could cite it.
const NUMBER_RE = /(?<!\w)(-?\d{1,3}(?:[,\s]\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?)\s*(%|km|m|kg|usd|aed|sar|EGP|EUR|GBP)?/giu;
const ISO_DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/g;
const DDMMYYYY_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;

export async function extractFromBuffer(
  fileId: string,
  filename: string,
  mime: string,
  buf: Buffer,
): Promise<ExtractedDoc> {
  const lower = filename.toLowerCase();
  let text = "";
  let status: ExtractedDoc["status"] = "extracted";
  const warnings: string[] = [];
  let pages: { number: number; text: string }[] | undefined;

  try {
    if (buf.length > 10 * 1024 * 1024) throw new Error("file_too_large");
    if (mime === "text/plain" || lower.endsWith(".txt")) {
      text = buf.toString("utf-8");
    } else if (lower.endsWith(".csv") || mime === "text/csv") {
      text = buf.toString("utf-8");
    } else if (lower.endsWith(".pdf") || mime === "application/pdf") {
      const out = await tryPdf(buf);
      text = out.text;
      pages = out.pages;
    } else if (lower.endsWith(".docx")) {
      text = await tryDocx(buf);
    } else if (lower.endsWith(".pptx")) {
      text = await tryPptx(buf);
    } else if (lower.endsWith(".xlsx")) {
      text = await tryXlsx(buf);
    } else {
      status = "unsupported";
      warnings.push("Unsupported format. Convert to PDF, DOCX, PPTX, XLSX, CSV or TXT.");
    }
  } catch {
    text = "";
    status = "failed";
    warnings.push("Extraction failed; no usable source was created.");
  }

  text = sanitiseForAgent(text);
  if (pages) pages = pages.map(p => ({ ...p, text: sanitiseForAgent(p.text) }));
  if (text.length > 200_000) { text = ""; pages = []; status = "failed"; warnings.push("Source exceeds 200,000 extracted characters."); }
  if (!text.trim() && status === "extracted") { status = "empty"; warnings.push("No readable text. Scanned pages and embedded images require OCR or a text version; no OCR was performed."); }

  return {
    fileId,
    status,
    warnings,
    text,
    pages,
    numbers: extractNumbers(text),
    dates: extractDates(text),
  };
}

// ----------- format-specific best-effort parsers -----------

async function tryPdf(buf: Buffer): Promise<{ text: string; pages: { number: number; text: string }[] }> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(buf), useSystemFonts: false, disableFontFace: true });
  const timeout = setTimeout(() => { void task.destroy(); }, 30_000);
  try {
    const doc = await task.promise;
    if (doc.numPages > 200) throw new Error("page_limit");
    const pages: { number: number; text: string }[] = [];
    let chars = 0;
    for (let number = 1; number <= doc.numPages; number++) {
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      let lastY: number | undefined;
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = item.transform[5];
        text += (lastY !== undefined && lastY !== y ? "\n" : text ? " " : "") + item.str;
        lastY = y;
      }
      chars += text.length; if (chars > 200_000) throw new Error("text_limit");
      pages.push({ number, text }); page.cleanup();
    }
    return { text: pages.map(p => p.text).join("\n\n"), pages };
  } finally { clearTimeout(timeout); await task.destroy(); }
}

async function tryDocx(buf: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const out = await mammoth.extractRawText({ buffer: buf });
    return out.value ?? "";
  } catch {
    return "";
  }
}

async function tryPptx(buf: Buffer): Promise<string> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buf);
    const slidePaths = Object.keys(zip.files).filter(
      (p) => p.startsWith("ppt/slides/slide") && p.endsWith(".xml"),
    ).sort((a, b) => Number(a.match(/slide(\d+)\.xml/)?.[1]) - Number(b.match(/slide(\d+)\.xml/)?.[1]));
    const out: string[] = [];
    for (const path of slidePaths) {
      const xml = await zip.files[path].async("string");
      out.push(xmlText(xml));
    }
    return out.join("\n");
  } catch {
    return "";
  }
}

/**
 * The text a reader would see in a cell.
 *
 * ExcelJS returns structured values where SheetJS returned display strings,
 * so this has to unwrap them itself. The choices matter for evidence: a
 * formula contributes its *result*, because that is the number on the page
 * and the number a claim will cite -- not "=SUM(B2:B9)", which cites
 * nothing. An error cell contributes its error text rather than being
 * silently dropped, so a broken spreadsheet reads as broken.
 */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("result" in v) return cellText(v.result); // formula / shared formula
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((r) => String((r as { text?: unknown }).text ?? "")).join("");
    }
    if ("text" in v) return String(v.text ?? ""); // hyperlink
    if ("error" in v) return String(v.error ?? "");
    return "";
  }
  return String(value);
}

/** RFC 4180: quote only when the value would otherwise break the row. */
function csvCell(text: string): string {
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function tryXlsx(buf: Buffer): Promise<string> {
  try {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);

    const out: string[] = [];
    wb.eachSheet((sheet) => {
      const width = sheet.columnCount;
      const rows: string[] = [];
      // Index-based rather than eachRow/eachCell: those skip empties, which
      // would shift columns and silently misalign a value from its header.
      for (let r = 1; r <= sheet.rowCount; r += 1) {
        const row = sheet.getRow(r);
        const cells: string[] = [];
        for (let c = 1; c <= width; c += 1) cells.push(csvCell(cellText(row.getCell(c).value)));
        while (cells.length && cells[cells.length - 1] === "") cells.pop();
        rows.push(cells.join(","));
      }
      while (rows.length && rows[rows.length - 1] === "") rows.pop();
      out.push(`# ${sheet.name}\n${rows.join("\n")}`);
    });
    return out.join("\n\n");
  } catch {
    return "";
  }
}

function xmlText(xml: string): string {
  return xml
    .replace(/<a:br\s*\/>/g, "\n")
    .replace(/<\/a:p>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNumbers(text: string): { value: number; unit?: string }[] {
  const out: { value: number; unit?: string }[] = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    const raw = m[1].replace(/[\s,]/g, "");
    const v = Number(raw);
    if (Number.isFinite(v)) out.push({ value: v, unit: m[2]?.toLowerCase() });
    if (out.length > 200) break;
  }
  return out;
}

function extractDates(text: string): { iso: string }[] {
  const out: { iso: string }[] = [];
  for (const m of text.matchAll(ISO_DATE_RE)) out.push({ iso: m[1] });
  for (const m of text.matchAll(DDMMYYYY_RE)) {
    const [_, dd, mm, yyyy] = m;
    out.push({ iso: `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}` });
  }
  return out;
}
