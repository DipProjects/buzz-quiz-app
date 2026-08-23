"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ref, set, get, child } from "firebase/database";
import { db } from "@/lib/firebase";
import { colorForIndex, makeTeamId } from "@/lib/questions";

export default function Home() {
  return (
    <Suspense fallback={<div className="app"><div className="wrap"><div className="card"><h2>Loading...</h2></div></div></div>}>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState(null); // null | "join"
  const [teamName, setTeamName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = searchParams.get("code") || searchParams.get("pin");
    if (q) {
      setPin(q.replace(/\D/g, "").slice(0, 6) || q.toUpperCase());
      setMode("join");
    }
  }, [searchParams]);

  async function joinGame() {
    setError("");
    const cleanPin = pin.trim().replace(/\s/g, "");
    const cleanName = teamName.trim();
    if (!cleanName) { setError("Team name daalo"); return; }
    if (!cleanPin) { setError("Game PIN daalo"); return; }

    setBusy(true);
    try {
      const roomSnap = await get(child(ref(db), `rooms/${cleanPin}`));
      if (!roomSnap.exists()) {
        setError("Ye PIN nahi mila. Host se PIN check karo.");
        setBusy(false);
        return;
      }
      const roomVal = roomSnap.val();
      const existingTeams = roomVal.teams || {};
      const teamId = makeTeamId();
      const color = colorForIndex(Object.keys(existingTeams).length);

      await set(ref(db, `rooms/${cleanPin}/teams/${teamId}`), {
        name: cleanName,
        color,
        joinedAt: Date.now(),
      });
      await set(ref(db, `rooms/${cleanPin}/scores/${teamId}`), 0);

      sessionStorage.setItem(`buzzquiz_teamId_${cleanPin}`, teamId);
      sessionStorage.setItem(`buzzquiz_teamName_${cleanPin}`, cleanName);

      router.push(`/team/${cleanPin}`);
    } catch {
      setError("Join fail. Dobara try karo.");
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <div className="wrap">
        <div className="brand">
          <span className="mark">Buzz-In Live</span>
          <span className="sub">Kahoot-style Team Quiz</span>
        </div>

        {mode === null && (
          <div className="card kahoot-home">
            <h2>Play or Host</h2>
            <p className="desc">
              Kahoot vibes: pehle quiz save karo, phir Host → PIN. Buzz <b>10s</b>, jawab <b>20s</b>,
              miss kiya toh #2 phir #3 — drama guaranteed.
            </p>
            <div className="role-grid">
              <Link href="/library" className="role-btn host" style={{ textDecoration: "none", textAlign: "center" }}>
                🖥️ Host — My Quizzes
              </Link>
              <button className="role-btn" onClick={() => { setMode("join"); setError(""); }}>
                🙋 Enter PIN to Join
              </button>
            </div>
          </div>
        )}

        {mode === "join" && (
          <div className="card">
            <h2>Join Game</h2>
            <p className="desc">Host screen pe dikhne wala 6-digit PIN daalo.</p>
            <label>Game PIN</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 482916"
              className="pin-input"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^\dA-Za-z]/g, "").slice(0, 8))}
            />
            <label>Your Team Name</label>
            <input
              type="text"
              placeholder="e.g. The Buzzer Beaters"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
            {error && <p className="small" style={{ color: "var(--wrong)" }}>{error}</p>}
            <div className="btn-row">
              <button className="btn ghost" disabled={busy} onClick={() => { setMode(null); setError(""); }}>← Back</button>
              <button className="btn primary" disabled={busy} onClick={joinGame}>
                {busy ? "Joining..." : "Join"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
