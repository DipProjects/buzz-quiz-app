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
} from "@/lib/questions";
import {
  startBuzzingPatch,
  startMediaPatch,
  buildBuzzQueue,
  clearQuestionTimers,
  resolveBuzzOrTiePatch,
  reopenBuzzPatch,
} from "@/lib/gameFlow";
import QuestionMedia from "@/components/QuestionMedia";
import FinalReport from "@/components/FinalReport";
import CountdownTimer from "@/components/CountdownTimer";
import RoundIntermission from "@/components/RoundIntermission";

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

  // Host clock: 0.2s collect → one winner answers, or tied teams re-buzz immediately (no queue).
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
        const queue = buildBuzzQueue(live.buzzes).filter((tid) => !allowed || allowed.includes(tid));
        if (queue.length === 0) return;

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
          const patch = resolveBuzzOrTiePatch(live2.buzzes, { allowedIds: allowed2 });
          if (patch) await update(ref(db, `rooms/${code}`), patch);
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
          // Timeout — reopen buzz for everyone (no queue handoff).
          await update(ref(db, `rooms/${code}`), {
            ...reopenBuzzPatch(),
            lastResult: "timeout",
          });
        } finally {
          advancing.current = false;
        }
      }
    }, 200);
    return () => clearInterval(id);
  }, [state?.phase, state?.buzzes, state?.buzzResolveAt, state?.answerDeadline, code]);

  // After round-start splash, auto-open the first question for that round.
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
      <div className="app">
        <div className="wrap">
          <div className="card funny-card"><h2>Loading game…</h2></div>
        </div>
      </div>
    );
  }

  if (state === false) {
    return (
      <div className="app">
        <div className="wrap">
          <div className="brand">
            <span className="mark">Buzz-In Live</span>
            <span className="sub">Live Host</span>
          </div>
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

  return (
    <div className="app">
      <div className="wrap">
        <div className="brand">
          <span className="mark">Buzz-In Live</span>
          <span className="sub">Live Host</span>
        </div>

        {isLobby && (
          <div className="card lobby-card funny-card">
            <p className="lobby-kicker">{state.quizTitle || "Live Quiz"}</p>
            <h2 className="lobby-title">Share this PIN with teams</h2>
            <div className="code-box pin-box">{code}</div>
            <p className="desc" style={{ textAlign: "center" }}>
              Teams → <b>Enter PIN to Join</b>. If 2–3 teams buzz at once → only they
              <b>re-buzz immediately</b>. Winner gets <b>{ANSWER_SECS}s</b>. No answer queue.
            </p>
            <p className="small" style={{ textAlign: "center" }}>
              Players joined: <b>{teamList.length}</b>
              {totalQuestions > 0 ? ` · ${totalQuestions} questions ready` : ""}
            </p>
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
          <div className="card persist-bar">
            <div className="small" style={{ margin: 0 }}>
              PIN <b>{code}</b>
              {state.quizTitle ? ` · ${state.quizTitle}` : ""}
            </div>
            <button className="btn ghost" onClick={backToLobby}>← Lobby</button>
          </div>
        )}

        {state.phase === "roundEnd" && (
          <div className="card funny-card">
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
          <div className="card funny-card">
            <RoundIntermission
              mode="start"
              roundName={rounds[state.roundIdx]?.name}
              scores={state.scores}
              teams={teams}
            />
          </div>
        )}

        {state.phase === "ended" && (
          <div className="card funny-card">
            <h2>🏁 Game over!</h2>
            <FinalReport scores={state.scores} teams={teams} />
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button className="btn primary" onClick={backToLobby}>Play again (same PIN)</button>
              <Link href="/library" className="btn ghost" style={{ textDecoration: "none" }}>
                My Quizzes
              </Link>
            </div>
          </div>
        )}

        {/* Media round */}
        {state.phase === "question" && liveRound && liveRoundType === "media" && item && (
          <>
            <div className="card">
              <div className="qnum">
                🎬 {liveRound.name} • Item {state.idx + 1}/{liveRound.questions.length}
              </div>
              {item.caption && <div className="qtext">{item.caption}</div>}
              <QuestionMedia img={item.img} video={item.video} media={item.media} />
            </div>
            <div className="status-banner locked">Playing on every team screen — no buzzer this round</div>
            <div className="card">
              <button className="btn primary" onClick={nextQuestion}>Next ▶</button>
            </div>
          </>
        )}

        {/* Quiz: buzzing / tie / tiebreak / answering / reveal */}
        {liveRound && liveRoundType === "quiz" && item &&
          (state.phase === "buzzing" ||
            state.phase === "tiebreak" ||
            state.phase === "answering" ||
            state.phase === "reveal") && (
            <>
              <div className="card">
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
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>

              {state.phase === "buzzing" && (
                <>
                  <div className="status-banner locked">
                    Buzz open. Same-time buzz (2–3) → only those teams re-buzz. No queue.
                    {Object.keys(state.buzzes || {}).length > 0 && (
                      <> · Catching buzzes… {Object.keys(state.buzzes).length}</>
                    )}
                  </div>
                  {Object.keys(state.buzzes || {}).length > 0 && (
                    <ul className="buzz-queue">
                      {buildBuzzQueue(state.buzzes).map((tid, i) => (
                        <li key={tid}>
                          <span className="bq-rank">#{i + 1}</span>
                          <span className="dot" style={{ background: teams[tid]?.color }} />
                          {teams[tid]?.name || "Team"}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {state.phase === "tiebreak" && (
                <>
                  <div className="status-banner tie">
                    Tie! Only{" "}
                    {(state.tiedTeams || []).map((tid) => teams[tid]?.name || "Team").join(" & ")}{" "}
                    — re-buzz now. Everyone else is locked out.
                    {Object.keys(state.buzzes || {}).length > 0 && " · catching re-buzzes…"}
                  </div>
                  {Object.keys(state.buzzes || {}).length > 0 && (
                    <ul className="buzz-queue">
                      {buildBuzzQueue(state.buzzes).map((tid, i) => (
                        <li key={tid}>
                          <span className="bq-rank">#{i + 1}</span>
                          <span className="dot" style={{ background: teams[tid]?.color }} />
                          {teams[tid]?.name || "Team"}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
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
                    {teams[state.buzzedTeam]?.name || "Team"} — answer now! ({ANSWER_SECS}s)
                  </div>
                  <div className="btn-row">
                    <button className="btn ghost" onClick={reopenBuzz}>
                      Reopen buzz
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
                    <>{teams[state.buzzedTeam]?.name || "Team"} got it right! +{POINTS_CORRECT}</>
                  )}
                  {state.lastResult === "wrong" && (
                    <>Wrong! {POINTS_WRONG} pts — buzz is open again for everyone</>
                  )}
                  {state.lastResult === "timeout" && <>Timed out — buzz reopened for everyone</>}
                  {state.lastResult === "nobody" && <>Nobody buzzed this round.</>}
                </div>
              )}

              {(state.phase === "reveal" || state.phase === "answering") && (
                <div className="card">
                  <button className="btn primary" onClick={nextQuestion}>
                    Next Question ▶
                  </button>
                </div>
              )}
            </>
          )}

        <div className="card">
          <h2>Leaderboard 🏆</h2>
          <ul className="leaderboard">
            {Object.entries(state.scores || {})
              .sort((a, b) => b[1] - a[1])
              .map(([tid, p]) => (
                <li key={tid}>
                  <span>
                    <span className="dot" style={{ background: teams[tid]?.color || "#8891a8" }} />
                    {teams[tid]?.name || "Unknown"}
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
