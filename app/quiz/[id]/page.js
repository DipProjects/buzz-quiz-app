"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getHostId,
  loadQuiz,
  saveQuiz,
  hostLiveGame,
} from "@/lib/hostLibrary";
import {
  emptyMediaItem,
  packMediaFields,
  normalizeMediaList,
  normalizeRounds,
  countItems,
} from "@/lib/questions";
import MultiMediaEditor from "@/components/MultiMediaEditor";

const emptyForm = { q: "", a: "", b: "", c: "", d: "", correct: 0, media: [] };

export default function QuizEditorPage({ params }) {
  const quizId = params.id;
  const router = useRouter();
  const [hostId, setHostId] = useState(null);
  const [title, setTitle] = useState("");
  const [rounds, setRounds] = useState(null);
  const [editingRound, setEditingRound] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [mediaForm, setMediaForm] = useState(emptyMediaItem());
  const [saveState, setSaveState] = useState(""); // "", "saving", "saved", "error"
  const [busyHost, setBusyHost] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = getHostId();
    setHostId(id);
    loadQuiz(id, quizId).then((q) => {
      if (!q) {
        setError("Quiz nahi mili");
        setRounds([]);
        return;
      }
      setTitle(q.title);
      setRounds(q.rounds);
    });
  }, [quizId]);

  const persist = useCallback(
    async (nextTitle, nextRounds) => {
      if (!hostId) return;
      setSaveState("saving");
      try {
        await saveQuiz(hostId, quizId, { title: nextTitle, rounds: nextRounds });
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "" : s)), 1500);
      } catch {
        setSaveState("error");
      }
    },
    [hostId, quizId]
  );

  function commitRounds(next) {
    const normalized = normalizeRounds(next);
    setRounds(normalized);
    persist(title, normalized);
  }

  function commitTitle(next) {
    setTitle(next);
    if (rounds) persist(next, rounds);
  }

  function addQuestion() {
    if (!form.q || !form.a || !form.b || !form.c || !form.d) {
      alert("Fill question and all 4 options");
      return;
    }
    const packed = packMediaFields(form.media);
    const newQ = {
      q: form.q,
      options: [form.a, form.b, form.c, form.d],
      correct: Number(form.correct),
      ...packed,
    };
    const next = rounds.slice();
    next[editingRound] = {
      ...next[editingRound],
      questions: [...(next[editingRound].questions || []), newQ],
    };
    commitRounds(next);
    setForm(emptyForm);
  }

  function addMediaItem() {
    const list = normalizeMediaList(mediaForm);
    if (list.length === 0) {
      alert("Kam se kam ek image ya video/reel daalo");
      return;
    }
    const newItem = { caption: mediaForm.caption || "", ...packMediaFields(list) };
    const next = rounds.slice();
    next[editingRound] = {
      ...next[editingRound],
      questions: [...(next[editingRound].questions || []), newItem],
    };
    commitRounds(next);
    setMediaForm(emptyMediaItem());
  }

  function removeQuestion(i) {
    const next = rounds.slice();
    const qs = (next[editingRound].questions || []).slice();
    qs.splice(i, 1);
    next[editingRound] = { ...next[editingRound], questions: qs };
    commitRounds(next);
  }

  function addRound(type) {
    const kindName = type === "media" ? "Media Round" : "Round";
    const sameTypeCount = rounds.filter((r) => (r.type || "quiz") === type).length;
    const next = [...rounds, { name: `${kindName} ${sameTypeCount + 1}`, type, questions: [] }];
    commitRounds(next);
    setEditingRound(next.length - 1);
  }

  function renameRound(i, name) {
    const next = rounds.slice();
    next[i] = { ...next[i], name };
    commitRounds(next);
  }

  function removeRound(i) {
    if (rounds.length <= 1) {
      alert("Kam se kam ek round chahiye");
      return;
    }
    if (!confirm(`${rounds[i].name} delete?`)) return;
    const next = rounds.slice();
    next.splice(i, 1);
    commitRounds(next);
    setEditingRound((prev) => Math.max(0, prev - (i <= prev ? 1 : 0)));
  }

  async function onHostLive() {
    if (countItems(rounds) === 0) {
      alert("Pehle kam se kam 1 question add karo");
      return;
    }
    setBusyHost(true);
    try {
      await persist(title, rounds);
      const pin = await hostLiveGame(hostId, { id: quizId, title, rounds });
      router.push(`/host/${pin}`);
    } catch {
      alert("Host fail — Firebase check karo");
      setBusyHost(false);
    }
  }

  if (error && !rounds?.length) {
    return (
      <div className="app">
        <div className="wrap">
          <div className="card">
            <h2>{error}</h2>
            <Link href="/library" className="btn primary" style={{ textDecoration: "none" }}>← My Quizzes</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!rounds) {
    return (
      <div className="app">
        <div className="wrap">
          <div className="card"><h2>Loading quiz...</h2></div>
        </div>
      </div>
    );
  }

  const currentRound = rounds[editingRound];
  const currentRoundType = currentRound?.type || "quiz";
  const total = countItems(rounds);

  return (
    <div className="app">
      <div className="wrap">
        <div className="brand">
          <span className="mark">Buzz-In Live</span>
          <span className="sub">Edit Quiz</span>
        </div>

        <div className="card">
          <div className="library-head">
            <div style={{ flex: 1 }}>
              <label>Quiz title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => commitTitle(e.target.value)}
                placeholder="e.g. Friday Fun Quiz"
                style={{ marginBottom: 0 }}
              />
            </div>
            <div className="save-pill">
              {saveState === "saving" && "Saving…"}
              {saveState === "saved" && "Saved ✓"}
              {saveState === "error" && "Save failed"}
              {!saveState && `${total} items`}
            </div>
          </div>
          <p className="persist-hint" style={{ marginTop: 12 }}>
            Auto-save on hai. Kitne chahe questions / media items add karo — limit nahi.
            Yeh quiz <b>My Quizzes</b> mein permanent rehti hai; PIN alag live session ke liye banta hai.
          </p>
          <div className="btn-row">
            <Link href="/library" className="btn ghost" style={{ textDecoration: "none" }}>← Library</Link>
            <button className="btn primary" disabled={busyHost || total === 0} onClick={onHostLive}>
              {busyHost ? "Starting…" : "▶ Host Live Game"}
            </button>
          </div>
        </div>

        <div className="card">
          <h2>Rounds</h2>
          <div className="round-tabs">
            {rounds.map((r, i) => (
              <button
                key={i}
                className={`round-tab ${i === editingRound ? "active" : ""}`}
                onClick={() => setEditingRound(i)}
              >
                {(r.type === "media" ? "🎬 " : "")}{r.name} ({r.questions?.length || 0})
              </button>
            ))}
          </div>
          <div className="btn-row" style={{ marginTop: 0, marginBottom: 14 }}>
            <button className="round-tab add" onClick={() => addRound("quiz")}>+ Add Quiz Round</button>
            <button className="round-tab add" onClick={() => addRound("media")}>+ Add Media Round 🎬</button>
          </div>

          {currentRound && (
            <>
              <label>Round name</label>
              <div className="btn-row" style={{ marginBottom: 8 }}>
                <input
                  type="text"
                  value={currentRound.name}
                  onChange={(e) => renameRound(editingRound, e.target.value)}
                  style={{ marginBottom: 0 }}
                />
                <button className="btn ghost" onClick={() => removeRound(editingRound)}>Delete Round</button>
              </div>

              {currentRoundType === "media" && (
                <p className="small media-hint">
                  🎬 Media round: sirf image / video / Reel — points nahi.
                </p>
              )}

              <h2 style={{ fontSize: 15, marginTop: 14 }}>
                {currentRoundType === "media" ? "Media items" : "Questions"} in {currentRound.name} (
                {currentRound.questions?.length || 0})
              </h2>

              {(currentRound.questions || []).map((q, i) => {
                const n = normalizeMediaList(q).length;
                const mediaLabel = n === 0 ? "" : ` · ${n} media`;
                return (
                  <div className="qlist-item" key={i}>
                    <span>
                      {i + 1}.{" "}
                      {currentRoundType === "media"
                        ? (q.caption || "(no caption)") + mediaLabel
                        : q.q + mediaLabel}
                    </span>
                    <button
                      className="btn ghost"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => removeQuestion(i)}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}

              {currentRoundType === "quiz" ? (
                <div className="qedit">
                  <label>Question text</label>
                  <input type="text" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} />
                  <label>Option A</label>
                  <input type="text" value={form.a} onChange={(e) => setForm({ ...form, a: e.target.value })} />
                  <label>Option B</label>
                  <input type="text" value={form.b} onChange={(e) => setForm({ ...form, b: e.target.value })} />
                  <label>Option C</label>
                  <input type="text" value={form.c} onChange={(e) => setForm({ ...form, c: e.target.value })} />
                  <label>Option D</label>
                  <input type="text" value={form.d} onChange={(e) => setForm({ ...form, d: e.target.value })} />
                  <label>Correct option</label>
                  <select value={form.correct} onChange={(e) => setForm({ ...form, correct: e.target.value })}>
                    <option value={0}>A</option>
                    <option value={1}>B</option>
                    <option value={2}>C</option>
                    <option value={3}>D</option>
                  </select>
                  <MultiMediaEditor
                    media={form.media}
                    roomCode={quizId}
                    onChange={(media) => setForm({ ...form, media })}
                  />
                  <button className="btn primary" style={{ marginTop: 12, width: "100%" }} onClick={addQuestion}>
                    + Add Question
                  </button>
                </div>
              ) : (
                <div className="qedit media-qedit">
                  <label>Caption (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Guess the movie"
                    value={mediaForm.caption}
                    onChange={(e) => setMediaForm({ ...mediaForm, caption: e.target.value })}
                  />
                  <MultiMediaEditor
                    media={mediaForm.media}
                    roomCode={quizId}
                    onChange={(media) => setMediaForm({ ...mediaForm, media })}
                  />
                  <button className="btn primary" style={{ marginTop: 12, width: "100%" }} onClick={addMediaItem}>
                    + Add media item
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
