"use client";
import { useEffect, useState } from "react";
import { funnyAnswerLine } from "@/lib/gameFlow";
import { ANSWER_SECS } from "@/lib/questions";

const SIZE = 150;
const STROKE = 11;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

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
  const pct = Math.max(0, Math.min(1, left / ANSWER_SECS));
  const dashOffset = CIRCUMFERENCE * (1 - pct);

  return (
    <div className={`timer-card answer ${urgent ? "urgent" : ""}`}>
      <div className="timer-label">{title}</div>
      <div className="timer-ring-wrap">
        <svg
          className="timer-ring"
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
        >
          <circle
            className="timer-ring-track"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE}
            fill="none"
          />
          <circle
            className="timer-ring-progress"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>
        <div className="timer-ring-center" key={left}>
          <span className="timer-digits">{left}</span>
          <span className="timer-unit">s</span>
        </div>
      </div>
      <div className="timer-fun">{funnyAnswerLine(left)}</div>
    </div>
  );
}
