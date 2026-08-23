"use client";
import { getStandings, getWinnerRunnerUp } from "@/lib/questions";

function names(rows) {
  return rows.map((r) => r.name).join(" & ");
}

export default function FinalReport({ scores, teams, highlightTeamId }) {
  const standings = getStandings(scores, teams);
  const { winners, runnersUp } = getWinnerRunnerUp(standings);

  if (standings.length === 0) {
    return <p className="small">No teams joined.</p>;
  }

  return (
    <div className="report">
      <div className="podium">
        <div className="podium-spot winner">
          <div className="podium-medal">🏆</div>
          <div className="podium-label">Winner{winners.length > 1 ? "s" : ""}</div>
          <div className="podium-name">{names(winners)}</div>
          <div className="podium-pts">{winners[0]?.points ?? 0} pts</div>
        </div>
        {runnersUp.length > 0 && (
          <div className="podium-spot runner">
            <div className="podium-medal">🥈</div>
            <div className="podium-label">Runner-up{runnersUp.length > 1 ? "s" : ""}</div>
            <div className="podium-name">{names(runnersUp)}</div>
            <div className="podium-pts">{runnersUp[0]?.points ?? 0} pts</div>
          </div>
        )}
      </div>

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
