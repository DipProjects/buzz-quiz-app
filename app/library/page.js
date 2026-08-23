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
      setError("Quiz create fail. Firebase rules mein hosts path allow hai?");
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
        setError("Pehle quiz mein kam se kam 1 question / media add karo.");
      } else {
        setError("Live game start nahi hua. Dobara try karo.");
      }
      setBusy(false);
    }
  }

  async function onDelete(quiz) {
    if (!confirm(`Delete "${quiz.title}"? Ye permanent hai — live PIN alag cheez hai.`)) return;
    try {
      await deleteQuiz(hostId, quiz.id);
    } catch {
      setError("Delete fail");
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
                Kahoot jaisa — quizzes yahan save rehti hain. Host dabao → naya PIN milta hai.
                Agli baar wapas aao, quizzes yahin milengi.
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
            <h2>Abhi koi quiz nahi</h2>
            <p className="desc">Create Quiz dabao, rounds &amp; questions add karo, phir Host se live khelo.</p>
          </div>
        )}

        {quizzes && quizzes.length > 0 && (
          <ul className="quiz-grid">
            {quizzes.map((q) => (
              <li key={q.id} className="quiz-card">
                <div className="quiz-card-body">
                  <h3>{q.title}</h3>
                  <p className="small">
                    {q.roundCount} round{q.roundCount === 1 ? "" : "s"} · {q.itemCount} question
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
                  <button className="btn ghost" disabled={busy} onClick={() => onDelete(q)}>
                    Delete
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
