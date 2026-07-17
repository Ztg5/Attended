/**
 * Instant navigation feedback. Every page is force-dynamic (server-rendered per
 * request), so without this the old page stays frozen until the new one is ready —
 * which reads as a tap delay. This Suspense fallback shows the moment you navigate.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div
        className="h-7 w-7 animate-spin rounded-full border-2"
        style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
