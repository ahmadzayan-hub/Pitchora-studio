import type { Source } from "./project";

/** Parse selected files in the browser. No fetch/upload of source bytes. */
export async function importSource(file: File): Promise<Source> {
  if (file.size > 10 * 1024 * 1024) throw new Error("Maximum source size is 10 MB");
  const name = file.name.toLowerCase();
  let text = ""; let pages: { number: number; text: string }[] | undefined;
  if (/\.(txt|md|csv)$/.test(name)) {
    text = await file.text();
  } else if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: false, disableFontFace: true });
    const timer = setTimeout(() => { void task.destroy(); }, 30_000);
    try {
      const doc = await task.promise; if (doc.numPages > 200) throw new Error("PDF limit is 200 pages");
      pages = []; let chars = 0;
      for (let number = 1; number <= doc.numPages; number++) {
        const page = await doc.getPage(number); const content = await page.getTextContent();
        let lastY: number | undefined; let pageText = "";
        for (const item of content.items) {
          if (!("str" in item)) continue;
          pageText += lastY !== undefined && lastY !== item.transform[5] ? "\n" : pageText ? " " : "";
          pageText += item.str; lastY = item.transform[5];
        }
        chars += pageText.length; if (chars > 100_000) throw new Error("Source text limit is 100,000 characters");
        pages.push({ number, text: pageText }); page.cleanup();
      }
      text = pages.map(p => p.text).join("\n\n");
    } finally { clearTimeout(timer); await task.destroy(); }
  } else {
    throw new Error("Use PDF, TXT, MD or CSV in local mode. DOCX, PPTX and XLSX use the authenticated project uploader.");
  }
  if (!text.trim() || text.includes("\u0000")) throw new Error("No readable text. Scanned images need OCR; no text was invented.");
  if (text.length > 100_000) throw new Error("Source text limit is 100,000 characters");
  return { id: crypto.randomUUID(), name: file.name, text, ...(pages ? { pages } : {}) };
}
