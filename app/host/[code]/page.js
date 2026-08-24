"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ref, onValue, update, get } from "firebase/database";
import { db } from "@/lib/firebase";
import {
  POINTS_CORRECT,
  POINTS_WRONG,
  normalizeRounds,
  countItems,
  asArray,
  ANSWER_SECS,
  TIE_WINDOW_MS,
  MAX_TEAMS_OPTIONS,
} from "@/lib/questions";
import {
  startBuzzingPatch,
  startMediaPatch,
  sortedBuzzIds,
  clearQuestionTimers,
  resolveBuzzOrTiePatch,
  reopenBuzzPatch,
  failAnswerPatch,
} from "@/lib/gameFlow";
import QuestionMedia from "@/components/QuestionMedia";
import FinalReport from "@/components/FinalReport";
import CountdownTimer from "@/components/CountdownTimer";
import BuzzWinnerPopup from "@/components/BuzzWinnerPopup";
import RoundIntermission from "@/components/RoundIntermission";
import Brand from "@/components/Brand";
import LoadingCard from "@/components/LoadingCard";

export default function HostPage({ params }) {
  const code = params.code;
  const [state, setState] = useState(null);
  const [pendingNextRound, setPendingNextRound] = useState(null);
  const advancing = useRef(false);

  useEffect(() => {
    const r = ref(db, `rooms/${code}`);
    const unsub = onValue(r, (snap) => setState(snap.exists() ? snap.val() : false));
    return () => unsub();
  }, [code]);

  // Host clock: 0.2s collect → one winner answers, or tied teams re-buzz.
  useEffect(() => {
    if (!state || state === false) return;
    const id = setInterval(async () => {
      if (advancing.current) return;
      const snap = await get(ref(db, `rooms/${code}`));
      const live = snap.val();
      if (!live) return;
      const now = Date.now();

      if (live.phase === "buzzing" || live.phase === "tiebreak") {
        const allowed = live.phase === "tiebreak" ? asArray(live.tiedTeams) : null;
        const elim = live.eliminatedTeams || {};
        const hits = sortedBuzzIds(live.buzzes).filter(
          (tid) => (!allowed || allowed.includes(tid)) && !elim[tid]
        );
        if (hits.length === 0) return;

        if (!live.buzzResolveAt) {
          advancing.current = true;
          try {
            await update(ref(db, `rooms/${code}`), { buzzResolveAt: Date.now() + TIE_WINDOW_MS });
          } finally {
            advancing.current = false;
          }
          return;
        }

        if (now < live.buzzResolveAt) return;

        advancing.current = true;
        try {
          const snap2 = await get(ref(db, `rooms/${code}`));
          const live2 = snap2.val();
          if (!live2 || (live2.phase !== "buzzing" && live2.phase !== "tiebreak")) return;
          const allowed2 = live2.phase === "tiebreak" ? asArray(live2.tiedTeams) : null;
          const elim2 = live2.eliminatedTeams || {};
          const filteredBuzzes = {};
          Object.entries(live2.buzzes || {}).forEach(([tid, ts]) => {
            if (elim2[tid]) return;
            if (allowed2 && !allowed2.includes(tid)) return;
            filteredBuzzes[tid] = ts;
          });
          const patch = resolveBuzzOrTiePatch(filteredBuzzes, {
            phase: live2.phase,
            allowedIds: allowed2,
            prevTiedTeams: asArray(live2.tiedTeams),
          });
          if (patch) {
            await update(ref(db, `rooms/${code}`), {
              ...patch,
              eliminatedTeams: live2.eliminatedTeams || null,
            });
          }
        } finally {
          advancing.current = false;
        }
        return;
      }

      if (live.phase === "answering" && live.answerDeadline && now >= live.answerDeadline) {
        advancing.current = true;
        try {
          const snap2 = await get(ref(db, `rooms/${code}`));
          const live2 = snap2.val();
          if (!live2 || live2.phase !== "answering") return;
          await update(ref(db, `rooms/${code}`), {
            ...failAnswerPatch(
              { ...live2, lastResult: "timeout" },
              live2.buzzedTeam,
              Object.keys(live2.teams || {})
            ),
            selectedOption: null,
          });
        } finally {
          advancing.current = false;
        }
      }
    }, 200);
    return () => clearInterval(id);
  }, [state?.phase, state?.buzzes, state?.buzzResolveAt, state?.answerDeadline, code]);

  useEffect(() => {
    if (state?.phase !== "roundStart") return;
    const idx = state.roundIdx ?? 0;
    const t = setTimeout(async () => {
      const snap = await get(ref(db, `rooms/${code}`));
      const live = snap.val();
      if (!live || live.phase !== "roundStart") return;
      const rs = normalizeRounds(live.rounds);
      const round = rs[idx];
      const type = round?.type || "quiz";
      const patch = type === "media" ? startMediaPatch() : startBuzzingPatch();
      await update(ref(db, `rooms/${code}`), { ...patch, roundIdx: idx, idx: 0, nextRoundIdx: null });
    }, 2800);
    return () => clearTimeout(t);
  }, [state?.phase, state?.roundIdx, code]);

  if (state === null) {
    return (
      <div className="app live-stage host-stage">
        <div className="wrap">
          <Brand tagline="Live Host" />
          <div className="card funny-card"><LoadingCard label="Loading game…" /></div>
        </div>
      </div>
    );
  }

  if (state === false) {
    return (
      <div className="app live-stage host-stage">
        <div className="wrap">
          <Brand tagline="Live Host" />
          <div className="card">
            <h2>Game not found</h2>
            <p className="desc">PIN <b>{code}</b> was not found. Host again from My Quizzes.</p>
            <Link href="/library" className="btn primary" style={{ textDecoration: "none" }}>
              ← My Quizzes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const roomRef = ref(db, `rooms/${code}`);
  const rounds = normalizeRounds(state.rounds);
  const teams = state.teams || {};
  const teamList = Object.entries(teams);
  const totalQuestions = countItems(rounds);
  const liveRound = rounds[state.roundIdx];
  const liveRoundType = liveRound?.type || "quiz";
  const isLobby = state.phase === "lobby" || state.phase === "setup";
  const item = liveRound?.questions?.[state.idx];
  const elim = state.eliminatedTeams || {};
  const buzzHits = sortedBuzzIds(state.buzzes).filter((tid) => !elim[tid]);

  const stageMood =
    state.phase === "tiebreak"
      ? "mood-tie"
      : state.phase === "answering"
        ? "mood-answer"
        : state.phase === "buzzing"
          ? "mood-buzz"
          : "";

  function beginItem(roundIdx, qIdx) {
    const round = rounds[roundIdx];
    const type = round?.type || "quiz";
    const patch =
      type === "media"
        ? { ...startMediaPatch(), roundIdx, idx: qIdx }
        : { ...startBuzzingPatch(), roundIdx, idx: qIdx };
    update(roomRef, patch);
  }

  function startGame() {
    let r = 0;
    while (r < rounds.length && !(rounds[r].questions?.length > 0)) r++;
    if (r >= rounds.length) return;
    update(roomRef, {
      phase: "roundStart",
      roundIdx: r,
      idx: 0,
      nextRoundIdx: null,
      ...clearQuestionTimers(),
    });
  }

  function nextQuestion() {
    const round = rounds[state.roundIdx];
    if (state.idx < (round.questions?.length || 0) - 1) {
      beginItem(state.roundIdx, state.idx + 1);
      return;
    }
    let nextRoundIdx = state.roundIdx + 1;
    while (
      nextRoundIdx < rounds.length &&
      (!rounds[nextRoundIdx].questions || rounds[nextRoundIdx].questions.length === 0)
    ) {
      nextRoundIdx++;
    }
    if (nextRoundIdx >= rounds.length) {
      update(roomRef, { phase: "ended", nextRoundIdx: null, ...clearQuestionTimers() });
    } else {
      setPendingNextRound(nextRoundIdx);
      update(roomRef, {
        phase: "roundEnd",
        nextRoundIdx,
        ...clearQuestionTimers(),
      });
    }
  }

  function startNextRound() {
    const idx = state.nextRoundIdx ?? pendingNextRound ?? state.roundIdx + 1;
    update(roomRef, {
      phase: "roundStart",
      roundIdx: idx,
      idx: 0,
      ...clearQuestionTimers(),
    });
    setPendingNextRound(null);
  }

  function backToLobby() {
    const resetScores = {};
    Object.keys(state.scores || {}).forEach((tid) => {
      resetScores[tid] = 0;
    });
    update(roomRef, {
      phase: "lobby",
      roundIdx: 0,
      idx: 0,
      scores: resetScores,
      ...clearQuestionTimers(),
    });
  }

  function reopenBuzz() {
    update(roomRef, reopenBuzzPatch());
  }

  function setMaxTeams(n) {
    update(roomRef, { maxTeams: n });
  }

  // Pop the celebration once per team that wins the buzzer floor (not on every re-render).
  const winnerTriggerKey =
    state.phase === "answering" && state.buzzedTeam
      ? `${state.buzzedTeam}-${state.roundIdx}-${state.idx}`
      : null;

  return (
    <div className={`app live-stage host-stage ${stageMood}`}>
      <div className="stage-glow" aria-hidden />
      <BuzzWinnerPopup
        triggerKey={winnerTriggerKey}
        teamName={teams[state.buzzedTeam]?.name}
        teamColor={teams[state.buzzedTeam]?.color}
        subtitle="is answering now"
      />
      <div className="wrap">
        <Brand tagline="Live Host" />

        {isLobby && (
          <div className="card lobby-card funny-card stage-card">
            <p className="lobby-kicker">{state.quizTitle || "Live Quiz"}</p>
            <h2 className="lobby-title">Share this PIN</h2>
            <div className="code-box pin-box">{code}</div>
            <p className="desc" style={{ textAlign: "center" }}>
              Same-time buzz → those teams re-buzz each other. No answer within{" "}
              {ANSWER_SECS}s (or a wrong answer) and that team is out for the question —
              floor reopens or tied teams re-buzz.
            </p>
            <p className="small" style={{ textAlign: "center" }}>
              Players joined: <b>{teamList.length}{state.maxTeams ? ` / ${state.maxTeams}` : ""}</b>
              {totalQuestions > 0 ? ` · ${totalQuestions} questions ready` : ""}
            </p>
            <div className="max-teams-picker">
              <span className="max-teams-label">Team limit</span>
              <div className="max-teams-opts">
                <button
                  type="button"
                  className={`chip-opt ${!state.maxTeams ? "active" : ""}`}
                  onClick={() => setMaxTeams(null)}
                >
                  No limit
                </button>
                {MAX_TEAMS_OPTIONS.map((n) => (
                  <button
                    type="button"
                    key={n}
                    className={`chip-opt ${state.maxTeams === n ? "active" : ""}`}
                    disabled={teamList.length > n}
                    onClick={() => setMaxTeams(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {teamList.length > 0 && (
              <ul className="lobby-players">
                {teamList.map(([tid, t]) => (
                  <li key={tid}>
                    <span className="dot" style={{ background: t.color }} />
                    {t.name}
                  </li>
                ))}
              </ul>
            )}
            <button
              className="btn primary"
              style={{ width: "100%", marginTop: 14 }}
              disabled={totalQuestions === 0}
              onClick={startGame}
            >
              ▶ Start
            </button>
            <div className="btn-row" style={{ justifyContent: "center" }}>
              <Link href="/library" className="btn ghost" style={{ textDecoration: "none" }}>
                ← My Quizzes
              </Link>
              {state.quizId && (
                <Link href={`/quiz/${state.quizId}`} className="btn ghost" style={{ textDecoration: "none" }}>
                  Edit quiz
                </Link>
              )}
            </div>
          </div>
        )}

        {!isLobby && (
          <div className="card persist-bar stage-bar">
            <div className="small" style={{ margin: 0 }}>
              PIN <b>{code}</b>
              {state.quizTitle ? ` · ${state.quizTitle}` : ""}
            </div>
            <button className="btn ghost" onClick={backToLobby}>← Lobby</button>
          </div>
        )}

        {state.phase === "roundEnd" && (
          <div className="card funny-card stage-card">
            <RoundIntermission
              mode="complete"
              roundName={rounds[state.roundIdx]?.name}
              nextRoundName={rounds[state.nextRoundIdx ?? pendingNextRound ?? state.roundIdx + 1]?.name}
              scores={state.scores}
              teams={teams}
            >
              <button className="btn primary" style={{ width: "100%", marginTop: 14 }} onClick={startNextRound}>
                ▶ Start next round
              </button>
            </RoundIntermission>
          </div>
        )}

        {state.phase === "roundStart" && (
          <div className="card funny-card stage-card">
            <RoundIntermission
              mode="start"
              roundName={rounds[state.roundIdx]?.name}
              scores={state.scores}
              teams={teams}
            />
          </div>
        )}

        {state.phase === "ended" && (
          <div className="card funny-card stage-card">
            <h2>Game over</h2>
            <FinalReport scores={state.scores} teams={teams} />
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button className="btn primary" onClick={backToLobby}>Play again (same PIN)</button>
              <Link href="/library" className="btn ghost" style={{ textDecoration: "none" }}>
                My Quizzes
              </Link>
            </div>
          </div>
        )}

        {state.phase === "question" && liveRound && liveRoundType === "media" && item && (
          <>
            <div className="card stage-card">
              <div className="qnum">
                {liveRound.name} • Item {state.idx + 1}/{liveRound.questions.length}
              </div>
              {item.caption && <div className="qtext">{item.caption}</div>}
              <QuestionMedia img={item.img} video={item.video} media={item.media} />
            </div>
            <div className="status-banner locked">Playing on every team screen — no buzzer</div>
            <div className="card stage-card">
              <button className="btn primary" onClick={nextQuestion}>Next ▶</button>
            </div>
          </>
        )}

        {liveRound && liveRoundType === "quiz" && item &&
          (state.phase === "buzzing" ||
            state.phase === "tiebreak" ||
            state.phase === "answering" ||
            state.phase === "reveal") && (
            <>
              <div className="card stage-card q-stage">
                <div className="qnum">
                  {liveRound.name} • Q{state.idx + 1}/{liveRound.questions.length}
                </div>
                <div className="qtext">{item.q}</div>
                <QuestionMedia img={item.img} video={item.video} media={item.media} />
                <div className="options">
                  {item.options.map((o, i) => {
                    let cls = "opt";
                    if (state.phase === "reveal") {
                      if (i === item.correct) cls += " correct";
                      else if (i === state.selectedOption) cls += " wrong";
                    } else if (state.phase === "answering" && i === state.selectedOption) {
                      cls += " picked";
                    }
                    return (
                      <button key={i} className={cls} disabled>
                        <span className="opt-letter">{String.fromCharCode(65 + i)}</span>
                        <span className="opt-text">{o}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {state.phase === "buzzing" && (
                <div className="host-buzz-panel">
                  {state.lastResult === "wrong" && (
                    <div className="status-banner wrong">
                      Wrong — {teams[state.buzzedTeam]?.name || "that team"} is out this question
                    </div>
                  )}
                  {state.lastResult === "timeout" && (
                    <div className="status-banner wrong">
                      Timed out — {teams[state.buzzedTeam]?.name || "that team"} is out this question
                    </div>
                  )}
                  {state.lastResult === "allOut" && (
                    <div className="status-banner tie">
                      Everyone's out — reopening this question for all teams!
                    </div>
                  )}
                  {(state.lastResult === "wrong" ||
                    state.lastResult === "timeout" ||
                    state.lastResult === "allOut") &&
                    state.buzzAgainQuote && (
                      <div className="buzz-again-quote">{state.buzzAgainQuote}</div>
                    )}
                  <div className="status-banner locked live-pulse">
                    Floor open — watching for buzzes
                    {buzzHits.length > 0 ? ` · ${buzzHits.length} in` : ""}
                  </div>
                  {buzzHits.length > 0 && (
                    <ul className="buzz-hits">
                      {buzzHits.map((tid) => (
                        <li key={tid} className="buzz-hit-chip pop-in">
                          <span className="dot" style={{ background: teams[tid]?.color }} />
                          {teams[tid]?.name || "Team"}
                          <span className="hit-tag">IN</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {Object.keys(elim).length > 0 && (
                    <p className="small elim-note">
                      Out this Q:{" "}
                      {Object.keys(elim)
                        .map((tid) => teams[tid]?.name || "Team")
                        .join(", ")}
                    </p>
                  )}
                </div>
              )}

              {state.phase === "tiebreak" && (
                <div className="host-buzz-panel tie-panel">
                  <div className="status-banner tie thunder">
                    Re-buzz round —{" "}
                    {(state.tiedTeams || []).map((tid) => teams[tid]?.name || "Team").join(" · ")}
                  </div>
                  <p className="small tie-rules">
                    2+ buzz together → all tied teams re-buzz · 1 alone → answers
                  </p>
                  {buzzHits.length > 0 && (
                    <ul className="buzz-hits">
                      {buzzHits.map((tid) => (
                        <li key={tid} className="buzz-hit-chip pop-in hot">
                          <span className="dot" style={{ background: teams[tid]?.color }} />
                          {teams[tid]?.name || "Team"}
                          <span className="hit-tag">RE</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {state.phase === "answering" && (
                <>
                  <CountdownTimer
                    deadline={state.answerDeadline}
                    label={`Answer clock · ${ANSWER_SECS}s`}
                  />
                  <div
                    className="status-banner locked"
                    style={{
                      borderColor: teams[state.buzzedTeam]?.color,
                      color: teams[state.buzzedTeam]?.color,
                    }}
                  >
                    {teams[state.buzzedTeam]?.name || "Team"} answering
                  </div>
                  <div className="btn-row">
                    <button className="btn ghost" onClick={reopenBuzz}>
                      Reset floor (all can buzz)
                    </button>
                  </div>
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
                >
                  {state.lastResult === "correct" && (
                    <>{teams[state.buzzedTeam]?.name || "Team"} — correct! +{POINTS_CORRECT}</>
                  )}
                  {state.lastResult === "wrong" && (
                    <>Wrong ({POINTS_WRONG}) — that team is out; floor reopens or tied teams re-buzz</>
                  )}
                  {state.lastResult === "timeout" && (
                    <>Timed out — that team is out; floor reopens or tied teams re-buzz</>
                  )}
                  {state.lastResult === "nobody" && <>Nobody buzzed.</>}
                </div>
              )}

              {(state.phase === "reveal" || state.phase === "answering") && (
                <div className="card stage-card">
                  <button className="btn primary" onClick={nextQuestion}>
                    Next Question ▶
                  </button>
                </div>
              )}
            </>
          )}

        <div className="card stage-card">
          <h2>Leaderboard</h2>
          <ul className="leaderboard">
            {Object.entries(state.scores || {})
              .sort((a, b) => b[1] - a[1])
              .map(([tid, p]) => (
                <li key={tid} className={elim[tid] ? "elim-row" : ""}>
                  <span>
                    <span className="dot" style={{ background: teams[tid]?.color || "#8891a8" }} />
                    {teams[tid]?.name || "Unknown"}
                    {elim[tid] ? <span className="elim-badge">out</span> : null}
                  </span>
                  <span className={`pts ${p > 0 ? "pos" : p < 0 ? "neg" : ""}`}>
                    {p > 0 ? "+" : ""}
                    {p}
                  </span>
                </li>
              ))}
          </ul>
          {teamList.length === 0 && <p className="small">Share the PIN — waiting for teams.</p>}
        </div>
      </div>
    </div>
  );
}
