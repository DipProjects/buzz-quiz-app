"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ref, onValue, update, set, get, serverTimestamp, runTransaction } from "firebase/database";
import { db } from "@/lib/firebase";
import {
  POINTS_CORRECT,
  POINTS_WRONG,
  normalizeRounds,
  ANSWER_SECS,
} from "@/lib/questions";
import { failAnswerPatch, asLineup } from "@/lib/gameFlow";
import QuestionMedia from "@/components/QuestionMedia";
import FinalReport from "@/components/FinalReport";
import CountdownTimer from "@/components/CountdownTimer";
import RoundIntermission from "@/components/RoundIntermission";
import AnswerLineup from "@/components/AnswerLineup";

export default function TeamPage({ params }) {
  const code = params.code;
  const [state, setState] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const [teamName, setTeamName] = useState("");
  const [ready, setReady] = useState(false);
  const [buzzing, setBuzzing] = useState(false);
  const [buzzFlash, setBuzzFlash] = useState(false);
  const selecting = useRef(false);

  useEffect(() => {
    const id = sessionStorage.getItem(`buzzquiz_teamId_${code}`);
    const name = sessionStorage.getItem(`buzzquiz_teamName_${code}`);
    setTeamId(id);
    setTeamName(name || "");
    setReady(true);
  }, [code]);

  useEffect(() => {
    const r = ref(db, `rooms/${code}`);
    const unsub = onValue(r, (snap) => setState(snap.val()));
    return () => unsub();
  }, [code]);

  useEffect(() => {
    selecting.current = false;
  }, [state?.phase, state?.buzzedTeam, state?.idx, state?.answerSlot]);

  if (!ready || (ready && teamId && !state)) {
    return (
      <div className="app live-stage team-stage">
        <div className="wrap">
          <div className="card funny-card"><h2>Loading…</h2></div>
        </div>
      </div>
    );
  }

  if (!teamId || (state && !state.teams?.[teamId])) {
    return (
      <div className="app live-stage team-stage">
        <div className="wrap">
          <div className="brand"><span className="mark">Buzz-In Live</span></div>
          <div className="card">
            <h2>Session not found</h2>
            <p className="desc">
              This device is not in room <b>{code}</b>. Join again with the PIN.
            </p>
            <Link
              href="/"
              className="btn primary"
              style={{ display: "inline-block", textDecoration: "none", textAlign: "center" }}
            >
              ← Join Again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const teams = state.teams || {};
  const scores = state.scores || {};
  const myColor = teams[teamId]?.color;
  const myScore = scores[teamId] || 0;
  const rounds = normalizeRounds(state.rounds);
  const round = rounds[state.roundIdx];
  const roundType = round?.type || "quiz";
  const item = round?.questions?.[state.idx];
  const isAnswering = state.phase === "answering" && state.buzzedTeam === teamId;
  const buzzes = state.buzzes || {};
  const tiedTeams = state.tiedTeams || [];
  const eliminated = state.eliminatedTeams || {};
  const amEliminated = !!eliminated[teamId];
  const inTiebreak = state.phase === "tiebreak";
  const eligibleForTiebreak = inTiebreak && tiedTeams.includes(teamId);
  const alreadyBuzzed = buzzes[teamId] != null;
  const canBuzz =
    !alreadyBuzzed &&
    !amEliminated &&
    (state.phase === "buzzing" || eligibleForTiebreak);

  async function buzz() {
    if (buzzing || !canBuzz) return;
    setBuzzing(true);
    setBuzzFlash(true);
    try {
      await set(ref(db, `rooms/${code}/buzzes/${teamId}`), serverTimestamp());
    } finally {
      setBuzzing(false);
      setTimeout(() => setBuzzFlash(false), 450);
    }
  }

  async function selectOption(i) {
    if (!isAnswering || state.phase !== "answering" || selecting.current) return;
    if (state.answerLock) return;
    selecting.current = true;

    try {
      const lockTx = await runTransaction(ref(db, `rooms/${code}/answerLock`), (cur) => {
        if (cur) return;
        return teamId;
      });
      if (!lockTx.committed) return;

      const snap = await get(ref(db, `rooms/${code}`));
      const live = snap.val();
      if (!live || live.phase !== "answering" || live.buzzedTeam !== teamId) return;

      const correct = i === item.correct;
      const scoreRef = ref(db, `rooms/${code}/scores/${teamId}`);
      await runTransaction(scoreRef, (cur) => (cur || 0) + (correct ? POINTS_CORRECT : POINTS_WRONG));

      if (correct) {
        await update(ref(db, `rooms/${code}`), {
          phase: "reveal",
          selectedOption: i,
          lastResult: "correct",
          answerDeadline: null,
          answerLock: teamId,
        });
        return;
      }

      // Wrong → backup from same-time pair, or re-buzz tied pool.
      await update(ref(db, `rooms/${code}`), {
        ...failAnswerPatch({ ...live, lastResult: "wrong", selectedOption: i }, teamId),
      });
    } finally {
      // Keep selecting true until phase flips so rapid taps can't slip through.
      setTimeout(() => {
        selecting.current = false;
      }, 800);
    }
  }

  const liveQuiz =
    roundType === "quiz" &&
    item &&
    (state.phase === "buzzing" ||
      state.phase === "tiebreak" ||
      state.phase === "answering" ||
      state.phase === "reveal");

  const stageMood =
    state.phase === "tiebreak"
      ? "mood-tie"
      : state.phase === "answering"
        ? "mood-answer"
        : state.phase === "buzzing"
          ? "mood-buzz"
          : "";

  return (
    <div className={`app live-stage team-stage ${stageMood} ${buzzFlash ? "buzz-hit" : ""}`}>
      <div className="stage-glow" aria-hidden />
      <div className="wrap">
        <div className="team-header live-header" style={{ borderColor: myColor }}>
          <span className="dot" style={{ background: myColor }} />
          <span className="team-header-name">{teamName || teams[teamId]?.name}</span>
          <span className={`pts ${myScore > 0 ? "pos" : myScore < 0 ? "neg" : ""}`}>
            {myScore > 0 ? "+" : ""}
            {myScore} pts
          </span>
        </div>

        {(state.phase === "setup" || state.phase === "lobby") && (
          <div className="card funny-card stage-card">
            <h2>You&apos;re in!</h2>
            <p className="desc">
              Wait for the host. Same-time buzz → those teams re-buzz. Two buzz together?
              First answers; if wrong, the other from that pair gets a turn.
            </p>
          </div>
        )}

        {state.phase === "roundEnd" && (
          <div className="card funny-card stage-card">
            <RoundIntermission
              mode="complete"
              roundName={round?.name}
              nextRoundName={rounds[state.nextRoundIdx]?.name}
              scores={scores}
              teams={teams}
              highlightTeamId={teamId}
            >
              <p className="small" style={{ textAlign: "center", marginTop: 12, marginBottom: 0 }}>
                Waiting for the host to start the next round…
              </p>
            </RoundIntermission>
          </div>
        )}

        {state.phase === "roundStart" && (
          <div className="card funny-card stage-card">
            <RoundIntermission
              mode="start"
              roundName={rounds[state.roundIdx]?.name}
              scores={scores}
              teams={teams}
              highlightTeamId={teamId}
            />
          </div>
        )}

        {state.phase === "ended" && (
          <div className="card stage-card">
            <h2>Game over</h2>
            <FinalReport scores={scores} teams={teams} highlightTeamId={teamId} />
          </div>
        )}

        {roundType === "media" && item && state.phase === "question" && (
          <div className="card stage-card">
            <div className="qnum">
              {round.name} • Item {state.idx + 1}/{round.questions.length}
            </div>
            {item.caption && <div className="qtext">{item.caption}</div>}
            <QuestionMedia img={item.img} video={item.video} media={item.media} />
            <p className="small" style={{ textAlign: "center", marginTop: 8 }}>
              Watch along — no buzzer this round
            </p>
          </div>
        )}

        {liveQuiz && (
          <>
            <div className="card stage-card q-stage">
              <div className="qnum">
                {round.name} • Q{state.idx + 1}/{round.questions.length}
              </div>
              <div className="qtext">{item.q}</div>
              <QuestionMedia img={item.img} video={item.video} media={item.media} />
              <div className={`options ${isAnswering ? "options-live" : ""}`}>
                {item.options.map((o, i) => {
                  let cls = "opt";
                  if (state.phase === "reveal") {
                    if (i === item.correct) cls += " correct";
                    else if (i === state.selectedOption) cls += " wrong";
                  }
                  return (
                    <button
                      key={i}
                      className={cls}
                      disabled={!isAnswering || !!state.answerLock}
                      onClick={() => selectOption(i)}
                    >
                      <span className="opt-letter">{String.fromCharCode(65 + i)}</span>
                      <span className="opt-text">{o}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {state.phase === "buzzing" && (
              <div className="buzz-arena">
                {amEliminated ? (
                  <div className="status-banner wrong">
                    You already answered wrong — wait for another team
                  </div>
                ) : alreadyBuzzed ? (
                  <div className="status-banner locked buzz-wait">
                    Buzz locked in — holding for a clean win or tie…
                  </div>
                ) : (
                  <>
                    <p className="buzz-hint">First clean buzz wins the floor</p>
                    <button
                      className="buzz-pad pulse"
                      onClick={buzz}
                      disabled={buzzing || !canBuzz}
                      aria-label="Buzz in"
                    >
                      <span className="buzz-pad-ring" />
                      <span className="buzz-pad-ring delay" />
                      <span className="buzz-pad-label">{buzzing ? "…" : "BUZZ"}</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {state.phase === "tiebreak" && (
              <div className="buzz-arena tie-arena">
                <div className="status-banner tie">
                  Tie group: {tiedTeams.map((tid) => teams[tid]?.name || "Team").join(" · ")}
                </div>
                {eligibleForTiebreak ? (
                  alreadyBuzzed ? (
                    <div className="status-banner locked">Re-buzz locked — resolving…</div>
                  ) : (
                    <>
                      <p className="buzz-hint hot">Re-buzz now — only tied teams</p>
                      <button
                        className="buzz-pad pulse rebuzz"
                        onClick={buzz}
                        disabled={buzzing || !canBuzz}
                        aria-label="Re-buzz"
                      >
                        <span className="buzz-pad-ring" />
                        <span className="buzz-pad-ring delay" />
                        <span className="buzz-pad-label">{buzzing ? "…" : "RE-BUZZ"}</span>
                      </button>
                    </>
                  )
                ) : (
                  <div className="status-banner locked">
                    Showdown between{" "}
                    {tiedTeams.map((tid) => teams[tid]?.name || "Team").join(" vs ")} — you&apos;re
                    watching
                  </div>
                )}
              </div>
            )}

            {state.phase === "answering" && (
              <>
                <CountdownTimer
                  deadline={state.answerDeadline}
                  label={`Answer · ${ANSWER_SECS}s`}
                />
                {asLineup(state.answerLineup).length > 1 && (
                  <AnswerLineup
                    lineup={state.answerLineup}
                    slot={state.answerSlot ?? 0}
                    teams={teams}
                  />
                )}
                {isAnswering ? (
                  <div className="status-banner correct answer-you">
                    Your turn — pick one answer
                    {(state.answerSlot ?? 0) > 0 ? " (backup turn)" : ""}
                  </div>
                ) : (
                  <div
                    className="status-banner locked"
                    style={{
                      borderColor: teams[state.buzzedTeam]?.color,
                      color: teams[state.buzzedTeam]?.color,
                    }}
                  >
                    {teams[state.buzzedTeam]?.name || "Team"} is answering
                    {asLineup(state.answerLineup).length > 1 &&
                    (state.answerSlot ?? 0) + 1 < asLineup(state.answerLineup).length
                      ? ` · ${teams[asLineup(state.answerLineup)[(state.answerSlot ?? 0) + 1]]?.name || "Next"} is next`
                      : ""}
                  </div>
                )}
              </>
            )}

            {state.phase === "reveal" && (
              <div
                className={`status-banner ${
                  state.lastResult === "correct"
                    ? "correct"
                    : state.lastResult === "nobody"
                      ? "tie"
                      : "wrong"
                }`}
                style={{ marginBottom: 0 }}
              >
                {state.lastResult === "correct" &&
                  (state.buzzedTeam === teamId
                    ? `Correct! +${POINTS_CORRECT} pts`
                    : `${teams[state.buzzedTeam]?.name || "Team"} got it`)}
                {state.lastResult === "wrong" &&
                  (state.buzzedTeam === teamId
                    ? `Wrong (${POINTS_WRONG}) — next team may get a turn or re-buzz`
                    : `Wrong — re-buzz or next turn`)}
                {state.lastResult === "timeout" && "Timed out — next turn or re-buzz"}
                {state.lastResult === "nobody" && "Nobody buzzed."}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
