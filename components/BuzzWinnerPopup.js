"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Celebration popup shown the moment a team wins the buzzer floor.
 * `triggerKey` should change exactly once per win (e.g. `${buzzedTeam}-${idx}-${roundIdx}`)
 * so the popup pops in once and then auto-hides, instead of re-showing on every render
 * while the room stays in the "answering" phase.
 */
export default function BuzzWinnerPopup({ triggerKey, teamName, teamColor, subtitle }) {
  const [visible, setVisible] = useState(false);
  const lastKey = useRef(null);

  useEffect(() => {
    if (!triggerKey || triggerKey === lastKey.current) return;
    lastKey.current = triggerKey;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, [triggerKey]);

  if (!visible || !teamName) return null;

  return (
    <div className="winner-popup-overlay" role="status" aria-live="polite">
      <div className="winner-popup-card" style={{ borderColor: teamColor || "var(--accent)" }}>
        <div className="winner-popup-burst" aria-hidden>
          <span>🎉</span>
          <span>⚡</span>
          <span>🎉</span>
        </div>
        <div className="winner-popup-title">Got the floor!</div>
        <div className="winner-popup-name" style={{ color: teamColor || "var(--accent)" }}>
          {teamName}
        </div>
        <div className="winner-popup-sub">{subtitle || "is answering now"}</div>
      </div>
    </div>
  );
}
