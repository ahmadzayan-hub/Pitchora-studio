import { describe, it, expect } from "vitest";
import { extractFromBuffer } from "./extractors";
const PDF = "JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDggMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgNyAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNCAwIG9iago8PAovQ29udGVudHMgOSAwIFIgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU2IDg0MS44ODk4IF0gL1BhcmVudCA3IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgNyAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYxMDIzMjM0MzQyKzA0JzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYxMDIzMjM0MzQyKzA0JzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0NvdW50IDIgL0tpZHMgWyAzIDAgUiA0IDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKOCAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxMTkKPj4Kc3RyZWFtCkdhcEBEXSsuKSYnRWliaTBkUjFwJlleVlQ4cFBtJDQhWUkvcGpcWE9CIisvbyNmXTxJbTVIR1lcLyQ+VS1SPVtMWykmZCpcR1h0Jk9Mc2U0P1NCSEZaKyc8cUc3WDppOzpzJTVgXkJqPVU+YkZ0NGBba0Y3MH4+ZW5kc3RyZWFtCmVuZG9iago5IDAgb2JqCjw8Ci9GaWx0ZXIgWyAvQVNDSUk4NURlY29kZSAvRmxhdGVEZWNvZGUgXSAvTGVuZ3RoIDEyMQo+PgpzdHJlYW0KR2FwUWgwRT1GLDBVXEgzVFxwTllUXlFLaz90Yz5JUCw7VyNVMV4yM2loUEVNXz9DVzRLSVNpOjpiVy42T0Jfc0tpNy1pY11HLSdPYDpSI19gOG0qMGAjSnFOPHUyJDU7WmYwV0tvZGo+JjFydU0iWUtkdHIiakR+PmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDEwCjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA2MSAwMDAwMCBuIAowMDAwMDAwMDkyIDAwMDAwIG4gCjAwMDAwMDAxOTkgMDAwMDAgbiAKMDAwMDAwMDQwMiAwMDAwMCBuIAowMDAwMDAwNjA1IDAwMDAwIG4gCjAwMDAwMDA2NzMgMDAwMDAgbiAKMDAwMDAwMDkzNCAwMDAwMCBuIAowMDAwMDAwOTk5IDAwMDAwIG4gCjAwMDAwMDEyMDggMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8NWY1ZGM3MDgyZGYwZjk1Y2EyZDYwMzI5YWU5MWY4ODA+PDVmNWRjNzA4MmRmMGY5NWNhMmQ2MDMyOWFlOTFmODgwPl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA2IDAgUgovUm9vdCA1IDAgUgovU2l6ZSAxMAo+PgpzdGFydHhyZWYKMTQxOQolJUVPRgo=";
describe("real PDF page extraction", () => {
  it("uses real page numbers instead of assigning all text to page 1", async () => {
    const doc = await extractFromBuffer("f", "source.pdf", "application/pdf", Buffer.from(PDF, "base64"));
    expect(doc.status).toBe("extracted");
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages?.[0]).toEqual({ number: 1, text: "First page budget AED 1200." });
    expect(doc.pages?.[1]).toEqual({ number: 2, text: "Second page actual AED 950." });
  });
  it("marks malformed PDFs failed rather than empty successful uploads", async () => {
    const doc = await extractFromBuffer("f", "bad.pdf", "application/pdf", Buffer.from("not a pdf"));
    expect(doc.status).toBe("failed"); expect(doc.text).toBe("");
  });
  it("does not interpret arbitrary binary or legacy XLS as UTF8 evidence", async () => {
    for (const name of ["archive.zip", "old.xls", "photo.png"]) {
      const doc = await extractFromBuffer("f", name, "application/octet-stream", Buffer.from([0, 1, 255]));
      expect(doc.status).toBe("unsupported"); expect(doc.text).toBe("");
    }
  });
});
