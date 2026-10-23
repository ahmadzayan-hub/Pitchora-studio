import { test, expect } from "@playwright/test";
test("real sources → review → PPTX / HTML → saved-project recovery", async ({ page }) => {
  const postedSources: string[] = [];
  page.on("request", request => { if (request.method() === "POST" && request.postData()?.includes("12400000")) postedSources.push(request.url()); });
  await page.goto("/presentiq/source-studio");
  await page.getByLabel("Presentation title", { exact: true }).fill("Budget review");
  await page.getByLabel("Paste your source text", { exact: true }).fill("Budget is AED 12400000. Actual cost is AED 11000000.");
  await page.getByRole("button", { name: "Compose source-led draft", exact: true }).click();
  await expect(page.getByLabel("Scene headline").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "PPTX", exact: true })).toBeDisabled();
  const checks = page.getByRole("checkbox");
  for (const checkbox of await checks.all()) await checkbox.check();
  await expect(page.getByRole("button", { name: "PPTX", exact: true })).toBeEnabled();
  for (const name of ["PPTX", "HTML / PDF"]) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const file = await download; expect(await file.failure()).toBeNull();
    expect(file.suggestedFilename()).toMatch(name === "PPTX" ? /\.pptx$/ : /\.html$/);
  }
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Restore local save", exact: true }).click();
  await expect(page.getByLabel("Visible content").first()).toHaveValue("Budget is AED 12400000.");
  await page.getByLabel("Visible content").first().fill("Unsupported savings 99%.");
  await expect(checks.first()).not.toBeChecked();
  await checks.first().check();
  await expect(page.getByRole("button", { name: "PPTX", exact: true })).toBeDisabled();
  expect(postedSources).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("invalid project restore preserves current draft and source text is not executed", async ({ page }) => {
  await page.goto("/presentiq/source-studio");
  await page.getByLabel("Presentation title", { exact: true }).fill("Source safety");
  await page.getByLabel("Paste your source text", { exact: true }).fill('<img src=x onerror="alert()"> is untrusted source text.');
  await page.getByRole("button", { name: "Compose source-led draft", exact: true }).click();
  await expect(page.getByLabel("Visible content").first()).toBeVisible();
  await page.getByLabel("Restore project JSON", { exact: true }).setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"format":"other"}') });
  await expect(page.getByRole("alert")).toContainText("Current work was preserved");
  await expect(page.getByLabel("Presentation title", { exact: true })).toHaveValue("Source safety");
});

test("browser PDF worker retains actual page attribution", async ({ page }) => {
  await page.goto("/presentiq/source-studio");
  await page.getByLabel("Presentation title", { exact: true }).fill("PDF source review");
  await page.getByLabel("Add PDF, TXT, MD or CSV sources", { exact: true }).setInputFiles({ name: "two-pages.pdf", mimeType: "application/pdf", buffer: Buffer.from("JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDggMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgNyAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNCAwIG9iago8PAovQ29udGVudHMgOSAwIFIgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU2IDg0MS44ODk4IF0gL1BhcmVudCA3IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgNyAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYxMDIzMjM0MzQyKzA0JzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYxMDIzMjM0MzQyKzA0JzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0NvdW50IDIgL0tpZHMgWyAzIDAgUiA0IDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKOCAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxMTkKPj4Kc3RyZWFtCkdhcEBEXSsuKSYnRWliaTBkUjFwJlleVlQ4cFBtJDQhWUkvcGpcWE9CIisvbyNmXTxJbTVIR1lcLyQ+VS1SPVtMWykmZCpcR1h0Jk9Mc2U0P1NCSEZaKyc8cUc3WDppOzpzJTVgXkJqPVU+YkZ0NGBba0Y3MH4+ZW5kc3RyZWFtCmVuZG9iago5IDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDEyMQo+PgpzdHJlYW0KR2FwUWgwRT1GLDBVXEgzVFxwTllUXlFLaz90Yz5JUCw7VyNVMV4yM2loUEVNXz9DVzRLSVNpOjpiVy42T0Jfc0tpNy1pY11HLSdPYDpSI19gOG0qMGAjSnFOPHUyJDU7WmYwV0tvZGo+JjFydU0iWUtkdHIiakR+PmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDEwCjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA2MSAwMDAwMCBuIAowMDAwMDAwMDkyIDAwMDAwIG4gCjAwMDAwMDAxOTkgMDAwMDAgbiAKMDAwMDAwMDQwMiAwMDAwMCBuIAowMDAwMDAwNjA1IDAwMDAwIG4gCjAwMDAwMDA2NzMgMDAwMDAgbiAKMDAwMDAwMDkzNCAwMDAwMCBuIAowMDAwMDAwOTk5IDAwMDAwIG4gCjAwMDAwMDEyMDggMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8NWY1ZGM3MDgyZGYwZjk1Y2EyZDYwMzI5YWU5MWY4ODA+PDVmNWRjNzA4MmRmMGY5NWNhMmQ2MDMyOWFlOTFmODgwPl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA2IDAgUgovUm9vdCA1IDAgUgovU2l6ZSAxMAo+PgpzdGFydHhyZWYKMTQxOQolJUVPRgo=", "base64") });
  await expect(page.getByRole("button", { name: "Compose source-led draft", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Compose source-led draft", exact: true }).click();
  await expect(page.getByLabel("Visible content").nth(1)).toHaveValue("Second page actual AED 950.");
  await expect(page.getByText(/two-pages.pdf · p.2/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("source-studio-pdf.png"), fullPage: true });
});
