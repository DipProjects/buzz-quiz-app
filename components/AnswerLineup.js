"use client";

import { asLineup } from "@/lib/gameFlow";

export default function AnswerLineup({ lineup, slot = 0, teams = {}, compact = false }) {
  const list = asLineup(lineup);
  if (!list.length) return null;

  if (compact && list.length === 1) {
    return (
      <div className="answer-lineup compact">
        <span className="lineup-now">
          <span className="dot" style={{ background: teams[list[0]]?.color }} />
          {teams[list[0]]?.name || "Team"} answers
        </span>
      </div>
    );
  }

  return (
    <div className="answer-lineup">
      <p className="lineup-title">Answer order (same-time buzz)</p>
      <ol className="lineup-steps">
        {list.map((tid, i) => {
          const name = teams[tid]?.name || "Team";
          const isNow = i === slot;
          const isDone = i < slot;
          return (
            <li key={tid} className={`lineup-step ${isNow ? "now" : ""} ${isDone ? "done" : ""}`}>
              <span className="lineup-step-num">{i + 1}</span>
              <span className="dot" style={{ background: teams[tid]?.color }} />
              <span className="lineup-step-name">{name}</span>
              {isNow && <span className="lineup-badge live">NOW</span>}
              {i === slot + 1 && !isDone && <span className="lineup-badge next">NEXT</span>}
              {isDone && <span className="lineup-badge done">DONE</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
