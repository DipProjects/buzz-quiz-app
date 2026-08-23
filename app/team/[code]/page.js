"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ref, onValue, update, set, serverTimestamp, runTransaction } from "firebase/database";
import { db } from "@/lib/firebase";
import {
  POINTS_CORRECT,
  POINTS_WRONG,
  normalizeRounds,
  asArray,
  BUZZ_SECS,
  ANSWER_SECS,
} from "@/lib/questions";
import { buildBuzzQueue, openAnsweringPatch } from "@/lib/gameFlow";
import QuestionMedia from "@/components/QuestionMedia";
import FinalReport from "@/components/FinalReport";
import CountdownTimer from "@/components/CountdownTimer";

export default function TeamPage({ params }) {
  const code = params.code;
  const [state, setState] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const [teamName, setTeamName] = useState("");
  const [ready, setReady] = useState(false);
  const [buzzing, setBuzzing] = useState(false);

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

  if (!ready || (ready && teamId && !state)) {
    return (
      <div className="app">
        <div className="wrap">
          <div className="card funny-card"><h2>Loading your destiny…</h2></div>
        </div>
      </div>
    );
  }

  if (!teamId || (state && !state.teams?.[teamId])) {
    return (
      <div className="app">
        <div className="wrap">
          <div className="brand"><span className="mark">Buzz-In Live</span></div>
          <div className="card">
            <h2>Session lost in space 🛸</h2>
            <p className="desc">
              Is device se room <b>{code}</b> join nahi dikha. Wapas PIN se join karo.
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
  const alreadyBuzzed = buzzes[teamId] != null;
  const canBuzz = state.phase === "buzzing" && !alreadyBuzzed;
  const queue = asArray(state.buzzQueue);
  const myQueuePos = queue.indexOf(teamId);

  async function buzz() {
    if (buzzing || !canBuzz) return;
    setBuzzing(true);
    try {
      await set(ref(db, `rooms/${code}/buzzes/${teamId}`), serverTimestamp());
    } finally {
      setBuzzing(false);
    }
  }

  async function selectOption(i) {
    if (!isAnswering || state.phase !== "answering") return;
    const correct = i === item.correct;
    const scoreRef = ref(db, `rooms/${code}/scores/${teamId}`);
    await runTransaction(scoreRef, (cur) => (cur || 0) + (correct ? POINTS_CORRECT : POINTS_WRONG));

    if (correct) {
      await update(ref(db, `rooms/${code}`), {
        phase: "reveal",
        selectedOption: i,
        lastResult: "correct",
        answerDeadline: null,
      });
      return;
    }

    // Wrong → next in buzz order (2nd, 3rd…)
    const nextIdx = (state.queueIndex || 0) + 1;
    const q = asArray(state.buzzQueue);
    if (nextIdx < q.length) {
      await update(ref(db, `rooms/${code}`), {
        ...openAnsweringPatch(q, nextIdx),
        selectedOption: i,
        lastResult: "wrong",
      });
    } else {
      await update(ref(db, `rooms/${code}`), {
        phase: "reveal",
        selectedOption: i,
        lastResult: "exhausted",
        answerDeadline: null,
      });
    }
  }

  const liveQuiz =
    roundType === "quiz" &&
    item &&
    (state.phase === "buzzing" || state.phase === "answering" || state.phase === "reveal");

  return (
    <div className="app">
      <div className="wrap">
        <div className="team-header" style={{ borderColor: myColor }}>
          <span className="dot" style={{ background: myColor }} />
          <span className="team-header-name">{teamName || teams[teamId]?.name}</span>
          <span className={`pts ${myScore > 0 ? "pos" : myScore < 0 ? "neg" : ""}`}>
            {myScore > 0 ? "+" : ""}
            {myScore} pts
          </span>
        </div>

        {(state.phase === "setup" || state.phase === "lobby") && (
          <div className="card funny-card">
            <h2>You&apos;re in! 🎉</h2>
            <p className="desc">
              Stretch those buzz-fingers. Host Start dabaye toh <b>{BUZZ_SECS}s</b> buzz +{" "}
              <b>{ANSWER_SECS}s</b> answer drama shuru.
            </p>
          </div>
        )}

        {state.phase === "roundEnd" && (
          <div className="card">
            <h2>🏁 {round?.name} done!</h2>
            <p className="desc">Host next round start karega… hydrate!</p>
          </div>
        )}

        {state.phase === "ended" && (
          <div className="card">
            <h2>🏁 Game over!</h2>
            <FinalReport scores={scores} teams={teams} highlightTeamId={teamId} />
          </div>
        )}

        {roundType === "media" && item && state.phase === "question" && (
          <div className="card">
            <div className="qnum">
              🎬 {round.name} • Clip {state.idx + 1}/{round.questions.length}
            </div>
            {item.caption && <div className="qtext">{item.caption}</div>}
            <QuestionMedia img={item.img} video={item.video} media={item.media} />
            <p className="small" style={{ textAlign: "center", marginTop: 8 }}>
              Cinema mode — no buzz, bas watch 🍿
            </p>
          </div>
        )}

        {liveQuiz && (
          <>
            <div className="card">
              <div className="qnum">
                {round.name} • Q{state.idx + 1}/{round.questions.length}
              </div>
              <div className="qtext">{item.q}</div>
              <QuestionMedia img={item.img} video={item.video} media={item.media} />
              <div className="options">
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
                      disabled={!isAnswering}
                      onClick={() => selectOption(i)}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>

            {state.phase === "buzzing" && (
              <>
                <CountdownTimer
                  deadline={state.buzzDeadline}
                  mode="buzz"
                  label="Sabke liye same buzz clock"
                />
                {alreadyBuzzed ? (
                  <div className="status-banner locked">
                    🔔 Buzzed! You&apos;re in the queue — #{buildBuzzQueue(buzzes).indexOf(teamId) + 1}. Hold tight!
                  </div>
                ) : (
                  <button className="buzz-btn pulse" onClick={buzz} disabled={buzzing || !canBuzz}>
                    {buzzing ? "…" : "🔔 BUZZ IN"}
                  </button>
                )}
              </>
            )}

            {state.phase === "answering" && (
              <>
                <CountdownTimer
                  deadline={state.answerDeadline}
                  mode="answer"
                  label="Answer timer (sabko dikh raha hai)"
                />
                {isAnswering ? (
                  <div className="status-banner correct">
                    🎯 Tumhari baari! {ANSWER_SECS}s mein option choose karo — warna next wale ko milega.
                  </div>
                ) : myQueuePos > (state.queueIndex || 0) ? (
                  <div className="status-banner locked">
                    👀 Tum queue mein #{myQueuePos + 1} ho. Agar yeh miss kare toh tumhara chance aa sakta hai!
                  </div>
                ) : (
                  <div
                    className="status-banner locked"
                    style={{
                      borderColor: teams[state.buzzedTeam]?.color,
                      color: teams[state.buzzedTeam]?.color,
                    }}
                  >
                    🔒 {teams[state.buzzedTeam]?.name || "Team"} jawab de raha hai…
                  </div>
                )}
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
                style={{ marginBottom: 0 }}
              >
                {state.lastResult === "correct" &&
                  (state.buzzedTeam === teamId
                    ? `✅ Sahi! +${POINTS_CORRECT} pts — legendary`
                    : `✅ ${teams[state.buzzedTeam]?.name || "Team"} got it`)}
                {state.lastResult === "wrong" &&
                  (state.buzzedTeam === teamId
                    ? `❌ Oops ${POINTS_WRONG} — next buzz hero aa raha`
                    : `❌ Galat — chance aage gaya`)}
                {state.lastResult === "timeout" && "⏰ Time out — next in line!"}
                {state.lastResult === "nobody" && "🦗 Koi buzz nahi. Crickets."}
                {state.lastResult === "exhausted" && "😅 Queue over — koi sahi nahi laaya"}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
