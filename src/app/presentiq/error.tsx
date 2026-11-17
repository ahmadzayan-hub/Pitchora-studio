"use client";

import { useEffect } from "react";

/**
 * Segment-level error boundary for /presentiq/*.
 *
 * Catches any thrown error inside the route tree so a broken page
 * shows a branded, actionable recovery UI instead of Next.js's raw
 * dev overlay or a naked 500. `reset()` re-runs the segment's render
 * without a full page reload, which handles the common case of a
 * transient LLM or DB glitch.
 *
 * `digest` is Next's opaque server-error ID. It is safe to display
 * (no stack, no PII) and lets support correlate a user report with
 * the Vercel log line.
 */
export default function PresentIqError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to the browser console so devs see it during local runs.
    // Vercel + real telemetry pick this up server-side via the digest.
    console.error("[presentiq] segment error", error);
  }, [error]);

  return (
    <div className="pq-error-shell" role="alert" aria-live="assertive">
      <div className="pq-error-icon" aria-hidden>!</div>
      <h1 className="pq-error-title">Something went wrong on this page.</h1>
      <p className="pq-error-sub">
        The page hit an unexpected error while it was loading. Trying again
        usually clears it. If it keeps happening, contact us with the
        reference below.
      </p>
      {error.digest ? (
        <p className="pq-error-digest">
          <span>Reference</span>
          <code>{error.digest}</code>
        </p>
      ) : null}
      <div className="pq-error-actions">
        <button
          type="button"
          onClick={() => reset()}
          className="pq-btn pq-btn-liquid pq-btn-liquid-primary pq-btn-liquid-pill"
        >
          Try again
        </button>
        <a
          href="/presentiq"
          className="pq-btn pq-btn-liquid pq-btn-liquid-pill"
        >
          Back to home
        </a>
      </div>
    </div>
  );
}
