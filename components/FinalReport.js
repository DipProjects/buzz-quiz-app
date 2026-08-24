"use client";
import { getStandings } from "@/lib/questions";
import Podium from "@/components/Podium";

export default function FinalReport({ scores, teams, highlightTeamId }) {
  const standings = getStandings(scores, teams);

  if (standings.length === 0) {
    return <p className="small">No teams joined.</p>;
  }

  return (
    <div className="report">
      <Podium scores={scores} teams={teams} highlightTeamId={highlightTeamId} />

      <ul className="leaderboard report-list">
        {standings.map((row) => (
          <li key={row.tid} className={row.tid === highlightTeamId ? "me" : ""}>
            <span>
              <span className="rank-num">#{row.rank}</span>
              <span className="dot" style={{ background: row.color }}></span>
              {row.name}
              {row.tid === highlightTeamId ? " (you)" : ""}
            </span>
            <span className={`pts ${row.points > 0 ? "pos" : row.points < 0 ? "neg" : ""}`}>
              {row.points > 0 ? "+" : ""}{row.points}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
