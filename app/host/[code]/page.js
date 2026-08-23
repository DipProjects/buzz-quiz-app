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
} from "@/lib/questions";
import {
  startBuzzingPatch,
  startMediaPatch,
  buildBuzzQueue,
  openAnsweringPatch,
  passToNextPatch,
  clearQuestionTimers,
} from "@/lib/gameFlow";
import QuestionMedia from "@/components/QuestionMedia";
import FinalReport from "@/components/FinalReport";
import CountdownTimer from "@/components/CountdownTimer";

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

  // Host is the clock: first buzz opens answers; answer timeout → next in queue.
  useEffect(() => {
    if (!state || state === false) return;
    const id = setInterval(async () => {
      if (advancing.current) return;
      const snap = await get(ref(db, `rooms/${code}`));
      const live = snap.val();
      if (!live) return;
      const now = Date.now();

      // No buzz timer — first buzz opens answers; later buzzes join the queue.
      if (live.phase === "buzzing") {
        const queue = buildBuzzQueue(live.buzzes);
        if (queue.length > 0) {
          advancing.current = true;
          try {
            await update(ref(db, `rooms/${code}`), openAnsweringPatch(queue, 0));
          } finally {
            advancing.current = false;
          }
        }
        return;
      }

      if (live.phase === "answering") {
        const full = buildBuzzQueue(live.buzzes);
        const current = asArray(live.buzzQueue);
        if (full.length > current.length) {
          await update(ref(db, `rooms/${code}`), { buzzQueue: full });
        }
        if (live.answerDeadline && now >= live.answerDeadline) {
          advancing.current = true;
          try {
            const snap2 = await get(ref(db, `rooms/${code}`));
            const live2 = snap2.val();
            if (!live2 || live2.phase !== "answering") return;
            await update(ref(db, `rooms/${code}`), {
              ...passToNextPatch({ ...live2, buzzQueue: buildBuzzQueue(live2.buzzes) }),
              lastResult: "timeout",
            });
          } finally {
            advancing.current = false;
          }
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [state?.phase, state?.buzzes, state?.answerDeadline, code]);

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
  const buzzQueue = asArray(state.buzzQueue);
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
    beginItem(r, 0);
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
      update(roomRef, { phase: "ended", ...clearQuestionTimers() });
    } else {
      setPendingNextRound(nextRoundIdx);
      update(roomRef, { phase: "roundEnd", ...clearQuestionTimers() });
    }
  }

  function startNextRound() {
    const idx = pendingNextRound ?? state.roundIdx + 1;
    beginItem(idx, 0);
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

  function forcePass() {
    update(roomRef, passToNextPatch(state));
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
              Teams → <b>Enter PIN to Join</b>. No buzz countdown — first to buzz answers.
              They get <b>{ANSWER_SECS}s</b>; miss/wrong and the next buzzed team gets a turn.
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
            <h2>🏁 {rounds[state.roundIdx]?.name} complete!</h2>
            <p className="desc">Next up: {rounds[pendingNextRound ?? state.roundIdx + 1]?.name}</p>
            <button className="btn primary" onClick={startNextRound}>▶ Next round, let&apos;s go</button>
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

        {/* Quiz: buzzing / answering / reveal */}
        {liveRound && liveRoundType === "quiz" && item &&
          (state.phase === "buzzing" || state.phase === "answering" || state.phase === "reveal") && (
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
                    Buzz is open (no time limit). First buzz is #1, then #2, #3…
                    {Object.keys(state.buzzes || {}).length > 0 && (
                      <> · In queue: {Object.keys(state.buzzes).length}</>
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
                    🎯 #{(state.queueIndex || 0) + 1} {teams[state.buzzedTeam]?.name || "Team"} — answer now!
                    {buzzQueue.length > 1 && (
                      <span className="small" style={{ display: "block", marginTop: 4 }}>
                        Up next:{" "}
                        {buzzQueue
                          .slice((state.queueIndex || 0) + 1)
                          .map((tid) => teams[tid]?.name)
                          .filter(Boolean)
                          .join(" → ") || "nobody else"}
                      </span>
                    )}
                  </div>
                  <div className="btn-row">
                    <button className="btn ghost" onClick={forcePass}>
                      Skip → next in queue
                    </button>
                  </div>
                </>
              )}

              {state.phase === "reveal" && (
                <div
                  className={`status-banner ${
                    state.lastResult === "correct"
                      ? "correct"
                      : state.lastResult === "nobody" || state.lastResult === "exhausted"
                        ? "tie"
                        : "wrong"
                  }`}
                >
                  {state.lastResult === "correct" && (
                    <>🎉 {teams[state.buzzedTeam]?.name || "Team"} got it right! +{POINTS_CORRECT}</>
                  )}
                  {state.lastResult === "wrong" && (
                    <>💥 Wrong! {POINTS_WRONG} pts — turning passes down the queue</>
                  )}
                  {state.lastResult === "timeout" && <>Timed out — chance moves to the next team</>}
                  {state.lastResult === "nobody" && <>Nobody buzzed this round.</>}
                  {state.lastResult === "exhausted" && (
                    <>Queue finished — nobody got it right. Next question?</>
                  )}
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
