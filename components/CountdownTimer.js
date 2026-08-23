"use client";
import { useEffect, useState } from "react";
import { funnyBuzzLine, funnyAnswerLine } from "@/lib/gameFlow";

export default function CountdownTimer({ deadline, mode = "buzz", label }) {
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
  const line = mode === "buzz" ? funnyBuzzLine(left) : funnyAnswerLine(left);
  const title = label || (mode === "buzz" ? "Buzz window" : "Answer timer");

  return (
    <div className={`timer-card ${mode} ${urgent ? "urgent" : ""}`}>
      <div className="timer-label">{title}</div>
      <div className="timer-digits" key={left}>
        {left}
        <span className="timer-unit">s</span>
      </div>
      <div className="timer-fun">{line}</div>
      <div className="timer-bar">
        <i
          style={{
            width: `${Math.min(100, (left / (mode === "buzz" ? 10 : 20)) * 100)}%`,
          }}
        />
      </div>
    </div>
  );
}
