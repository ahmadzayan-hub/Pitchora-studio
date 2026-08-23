/**
 * Spreadsheet extraction, tested against a real workbook.
 *
 * This path had no test when it ran on SheetJS, which is why swapping the
 * library was risky: the app still typechecks, still builds, still deploys,
 * and the failure only appears when someone uploads a spreadsheet and the
 * evidence comes back empty. These tests build an actual .xlsx in memory and
 * assert on what a reader would see.
 */
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { extractFromBuffer } from "./extractors";

async function workbook(build: (wb: ExcelJS.Workbook) => void): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  build(wb);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function extract(buf: Buffer) {
  return extractFromBuffer("f1", "budget.xlsx", "application/vnd.ms-excel", buf);
}

describe("spreadsheet extraction", () => {
  it("emits a heading per sheet and the rows beneath it", async () => {
    const buf = await workbook((wb) => {
      const s = wb.addWorksheet("Budget");
      s.addRow(["Item", "Cost"]);
      s.addRow(["Depot works", 12400000]);
    });
    const { text } = await extract(buf);
    expect(text).toContain("# Budget");
    expect(text).toContain("Item,Cost");
    expect(text).toContain("Depot works,12400000");
  });

  it("keeps every sheet, not just the first", async () => {
    const buf = await workbook((wb) => {
      wb.addWorksheet("One").addRow(["alpha"]);
      wb.addWorksheet("Two").addRow(["beta"]);
    });
    const { text } = await extract(buf);
    expect(text).toContain("# One");
    expect(text).toContain("# Two");
    expect(text).toContain("alpha");
    expect(text).toContain("beta");
  });

  it("contributes a formula's result, not its expression", async () => {
    // A claim citing "=SUM(B2:B3)" cites nothing. The number on the page is
    // the evidence.
    const buf = await workbook((wb) => {
      const s = wb.addWorksheet("Totals");
      s.addRow(["a", 100]);
      s.addRow(["b", 250]);
      s.getCell("B3").value = { formula: "SUM(B1:B2)", result: 350 };
    });
    const { text } = await extract(buf);
    expect(text).toContain("350");
    expect(text).not.toContain("SUM(B1:B2)");
  });

  it("quotes values that would otherwise break the row", async () => {
    const buf = await workbook((wb) => {
      const s = wb.addWorksheet("Notes");
      s.addRow(['Scope: design, build, and commission', 'He said "yes"']);
    });
    const { text } = await extract(buf);
    expect(text).toContain('"Scope: design, build, and commission"');
    expect(text).toContain('"He said ""yes"""');
  });

  it("holds columns in place when a cell is empty", async () => {
    // Skipping empties would shift a value under the wrong header, which is
    // worse than losing it: the reader would cite a real number against the
    // wrong label.
    const buf = await workbook((wb) => {
      const s = wb.addWorksheet("Grid");
      s.addRow(["A", "B", "C"]);
      const r = s.addRow([]);
      r.getCell(1).value = "x";
      r.getCell(3).value = "z";
    });
    const { text } = await extract(buf);
    expect(text).toContain("x,,z");
  });

  it("reads rich text as its plain content", async () => {
    const buf = await workbook((wb) => {
      const s = wb.addWorksheet("Rich");
      s.getCell("A1").value = {
        richText: [{ text: "Phase " }, { text: "Two" }],
      };
    });
    const { text } = await extract(buf);
    expect(text).toContain("Phase Two");
  });

  it("surfaces numbers to the caller, so claims can cite them", async () => {
    const buf = await workbook((wb) => {
      wb.addWorksheet("V").addRow(["Rate", 12.5, "Count", 240]);
    });
    const { numbers } = await extract(buf);
    expect(numbers?.some((n) => n.value === 12.5)).toBe(true);
    expect(numbers?.some((n) => n.value === 240)).toBe(true);
  });

  it("returns empty text for a file that is not a workbook, without throwing", async () => {
    const { text } = await extract(Buffer.from("not a spreadsheet"));
    expect(text).toBe("");
  });
});

describe("numbers survive extraction intact", () => {
  async function numbersFrom(rows: (string | number)[][]) {
    const buf = await workbook((wb) => {
      const s = wb.addWorksheet("N");
      for (const r of rows) s.addRow(r);
    });
    const { numbers } = await extract(buf);
    return (numbers ?? []).map((n) => n.value);
  }

  it("reads an unformatted number whole", async () => {
    // The bug this guards: alternation is leftmost-first, so a branch that
    // could match one-to-three digits won and 12400000 became 124.
    expect(await numbersFrom([["Contract value", 12400000]])).toContain(12400000);
  });

  it("still reads a number written with thousands separators", async () => {
    const buf = await workbook((wb) => {
      wb.addWorksheet("N").getCell("A1").value = "Total AED 12,400,000 inclusive";
    });
    const { numbers } = await extract(buf);
    expect(numbers?.map((n) => n.value)).toContain(12400000);
  });

  it("keeps a negative negative and whole", async () => {
    expect(await numbersFrom([["Variance", -5000]])).toContain(-5000);
  });

  it("keeps decimals", async () => {
    expect(await numbersFrom([["Rate", 12.5]])).toContain(12.5);
  });

  it("still attaches a unit when one follows the number", async () => {
    const buf = await workbook((wb) => {
      wb.addWorksheet("N").getCell("A1").value = "Track renewal 42km at 18%";
    });
    const { numbers } = await extract(buf);
    expect(numbers?.find((n) => n.value === 42)?.unit).toBe("km");
    expect(numbers?.find((n) => n.value === 18)?.unit).toBe("%");
  });
});
