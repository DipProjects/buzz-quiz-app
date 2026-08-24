"use client";

// Shared loading state — small spinner + message, used across pages
// wherever we're waiting on Firebase/session data before rendering.
export default function LoadingCard({ label = "Loading…" }) {
  return (
    <div className="loading-card" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="loading-label">{label}</span>
    </div>
  );
}
