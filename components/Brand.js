"use client";

// Shared brand header used at the top of every screen.
export default function Brand({ tagline }) {
  return (
    <div className="brand">
      <span className="brand-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
          <path d="M13 2 4 14h6l-1 8 10-13h-6l0-7z" fill="currentColor" />
        </svg>
      </span>
      <span className="brand-text">
        <span className="mark">Buzz-In Live</span>
        {tagline && <span className="sub">{tagline}</span>}
      </span>
    </div>
  );
}
