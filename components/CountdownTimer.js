"use client";
import { useEffect, useState } from "react";
import { funnyAnswerLine } from "@/lib/gameFlow";
import { ANSWER_SECS } from "@/lib/questions";

export default function CountdownTimer({ deadline, label }) {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!deadline) {
      setLeft(0);
      return;
    }
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return null;

  const urgent = left <= 3;
  const title = label || `Answer timer · ${ANSWER_SECS}s`;

  return (
    <div className={`timer-card answer ${urgent ? "urgent" : ""}`}>
      <div className="timer-label">{title}</div>
      <div className="timer-digits" key={left}>
        {left}
        <span className="timer-unit">s</span>
      </div>
      <div className="timer-fun">{funnyAnswerLine(left)}</div>
      <div className="timer-bar">
        <i style={{ width: `${Math.min(100, (left / ANSWER_SECS) * 100)}%` }} />
      </div>
    </div>
  );
}
