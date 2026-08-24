"use client";
import { getStandings, getPodiumGroups } from "@/lib/questions";

const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };
// Visual left-to-right order like a real podium: silver, gold, bronze.
const ORDER = [2, 1, 3];

function names(rows) {
  return rows.map((r) => r.name).join(" & ");
}

export default function Podium({ scores, teams, highlightTeamId }) {
  const standings = getStandings(scores, teams);
  if (standings.length === 0) return null;
  const groups = getPodiumGroups(standings);

  return (
    <div className="podium-blocks">
      {ORDER.map((rank) => {
        const rows = groups[rank];
        if (!rows || rows.length === 0) {
          return <div key={rank} className="pblock-slot empty" aria-hidden />;
        }
        const isMe = rows.some((r) => r.tid === highlightTeamId);
        return (
          <div key={rank} className={`pblock-slot rank-${rank} ${isMe ? "me" : ""}`}>
            <div className="pblock-medal">{MEDAL[rank]}</div>
            <div className="pblock-name">{names(rows)}{isMe ? " (you)" : ""}</div>
            <div className="pblock-pts">{rows[0].points} pts</div>
            <div className="pblock-bar">
              <span className="pblock-num">{rank}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
