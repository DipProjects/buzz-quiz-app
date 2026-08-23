"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getHostId,
  watchQuizzes,
  createQuiz,
  deleteQuiz,
  hostLiveGame,
} from "@/lib/hostLibrary";

export default function LibraryPage() {
  const router = useRouter();
  const [hostId, setHostId] = useState(null);
  const [quizzes, setQuizzes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = getHostId();
    setHostId(id);
    return watchQuizzes(id, setQuizzes);
  }, []);

  async function onCreate() {
    setBusy(true);
    setError("");
    try {
      const id = await createQuiz(hostId, "Untitled Quiz");
      router.push(`/quiz/${id}`);
    } catch {
      setError("Could not create quiz. Check Firebase rules allow /hosts.");
      setBusy(false);
    }
  }

  async function onHost(quiz) {
    setBusy(true);
    setError("");
    try {
      const pin = await hostLiveGame(hostId, quiz);
      router.push(`/host/${pin}`);
    } catch (e) {
      if (e?.message === "EMPTY_QUIZ") {
        setError("Add at least one question or media item before hosting.");
      } else {
        setError("Could not start live game. Please try again.");
      }
      setBusy(false);
    }
  }

  async function onDelete(quiz) {
    if (!confirm(`Delete "${quiz.title}"? This cannot be undone. Live PINs are separate.`)) return;
    try {
      await deleteQuiz(hostId, quiz.id);
    } catch {
      setError("Delete failed");
    }
  }

  return (
    <div className="app">
      <div className="wrap">
        <div className="brand">
          <span className="mark">Buzz-In Live</span>
          <span className="sub">My Quizzes</span>
        </div>

        <div className="card">
          <div className="library-head">
            <div>
              <h2>My Quizzes</h2>
              <p className="desc" style={{ marginBottom: 0 }}>
                Your quizzes stay saved here. Hit Host for a fresh live PIN anytime.
              </p>
            </div>
            <button className="btn primary" disabled={busy || !hostId} onClick={onCreate}>
              + Create Quiz
            </button>
          </div>
          {error && <p className="small" style={{ color: "var(--wrong)", marginTop: 10 }}>{error}</p>}
        </div>

        {quizzes === null && (
          <div className="card"><h2>Loading your quizzes...</h2></div>
        )}

        {quizzes && quizzes.length === 0 && (
          <div className="card empty-library">
            <h2>No quizzes yet</h2>
            <p className="desc">Create a quiz, add rounds and questions, then Host to go live.</p>
          </div>
        )}

        {quizzes && quizzes.length > 0 && (
          <ul className="quiz-grid">
            {quizzes.map((q) => (
              <li key={q.id} className="quiz-card">
                <div className="quiz-card-body">
                  <h3>{q.title}</h3>
                  <p className="small">
                    {q.roundCount} round{q.roundCount === 1 ? "" : "s"} · {q.itemCount} item
                    {q.itemCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="quiz-card-actions">
                  <button className="btn primary" disabled={busy} onClick={() => onHost(q)}>
                    ▶ Host
                  </button>
                  <Link href={`/quiz/${q.id}`} className="btn ghost" style={{ textDecoration: "none", textAlign: "center" }}>
                    Edit
                  </Link>
                  <button className="btn ghost danger-ghost" disabled={busy} onClick={() => onDelete(q)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="btn-row" style={{ marginTop: 8 }}>
          <Link href="/" className="btn ghost" style={{ textDecoration: "none" }}>← Home</Link>
        </div>
      </div>
    </div>
  );
}
