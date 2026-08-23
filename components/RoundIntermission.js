"use client";
import { getStandings } from "@/lib/questions";

export default function RoundIntermission({
  mode, // "complete" | "start"
  roundName,
  nextRoundName,
  scores,
  teams,
  highlightTeamId,
  children,
}) {
  const standings = getStandings(scores, teams);
  const isComplete = mode === "complete";

  return (
    <div className={`round-splash ${isComplete ? "complete" : "start"}`}>
      <div className="round-splash-burst" aria-hidden />
      <div className="round-splash-burst delay" aria-hidden />

      <p className="round-splash-kicker">
        {isComplete ? "Round finished" : "Get ready"}
      </p>
      <h2 className="round-splash-title">
        {isComplete ? (
          <>
            <span className="round-splash-emoji">🏁</span>
            {roundName || "Round"} complete!
          </>
        ) : (
          <>
            <span className="round-splash-emoji">🚀</span>
            {roundName || "Next round"} starts now
          </>
        )}
      </h2>

      {isComplete && nextRoundName && (
        <p className="desc round-splash-next">Up next: <b>{nextRoundName}</b></p>
      )}
      {!isComplete && (
        <p className="desc round-splash-next">Check the standings — then buzz when the question drops.</p>
      )}

      <div className="round-scoreboard">
        <div className="round-scoreboard-head">Live scores</div>
        {standings.length === 0 ? (
          <p className="small" style={{ margin: 0, textAlign: "center" }}>No scores yet</p>
        ) : (
          <ul className="round-score-list">
            {standings.map((row, i) => (
              <li
                key={row.tid}
                className={`round-score-row ${row.tid === highlightTeamId ? "me" : ""}`}
                style={{ animationDelay: `${0.12 + i * 0.08}s` }}
              >
                <span className="round-score-left">
                  <span className="round-score-rank">#{row.rank}</span>
                  <span className="dot" style={{ background: row.color }} />
                  <span className="round-score-name">
                    {row.name}
                    {row.tid === highlightTeamId ? " (you)" : ""}
                  </span>
                </span>
                <span className={`pts ${row.points > 0 ? "pos" : row.points < 0 ? "neg" : ""}`}>
                  {row.points > 0 ? "+" : ""}
                  {row.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {children}
    </div>
  );
}
