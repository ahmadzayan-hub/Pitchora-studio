import { describe, expect, it } from "vitest";
import { apiRequestError } from "./request-error";

describe("timeline request errors", () => {
  it("shows actionable unsupported weight validation instead of a generic label", async () => {
    const response = Response.json({ error: "Invalid deadline", details: { fieldErrors: { weight: ["Deadline weight is not supported"] }, formErrors: [] } }, { status: 400 });
    expect(await apiRequestError(response, "Try again")).toBe("Deadline weight is not supported");
  });

  it("includes form validation errors for conflicting completion fields", async () => {
    const response = Response.json({ error: "Invalid deadline", details: { fieldErrors: {}, formErrors: ["Conflicting completion fields"] } }, { status: 400 });
    expect(await apiRequestError(response, "Try again")).toBe("Conflicting completion fields");
  });

  it("shows other API errors", async () => {
    expect(await apiRequestError(Response.json({ error: "Unauthorized" }, { status: 401 }), "Try again")).toBe("Unauthorized");
  });

  it("uses the translated fallback for empty or malformed error responses", async () => {
    expect(await apiRequestError(new Response("Gateway error", { status: 502 }), "حاول مرة أخرى")).toBe("حاول مرة أخرى");
    expect(await apiRequestError(Response.json(null, { status: 500 }), "Try again")).toBe("Try again");
    expect(await apiRequestError(Response.json({ details: { fieldErrors: { bad: [null, 4] } } }, { status: 400 }), "Try again")).toBe("Try again");
  });
});
