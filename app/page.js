"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ref, set, get, child } from "firebase/database";
import { db } from "@/lib/firebase";
import { colorForIndex, makeTeamId, matchAllowedTeamName, ALLOWED_TEAM_NAMES } from "@/lib/questions";
import Brand from "@/components/Brand";
import LoadingCard from "@/components/LoadingCard";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="app">
          <div className="wrap">
            <Brand />
            <div className="card"><LoadingCard /></div>
          </div>
        </div>
      }
    >
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState(null);
  const [teamName, setTeamName] = useState("");
  const [pin, setPin] = useState("");
  const [hostPin, setHostPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const HOST_PIN = "425401";

  function submitHostPin() {
    if (hostPin.trim() === HOST_PIN) {
      sessionStorage.setItem("buzzquiz_host_authed", "1");
      router.push("/library");
    } else {
      setError("Wrong PIN. Only the host has access.");
    }
  }

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
    const rawName = teamName.trim();
    if (!rawName) { setError("Enter a team name"); return; }
    if (!cleanPin) { setError("Enter the game PIN"); return; }

    // Only pre-registered team names may join — matched case-insensitively,
    // then normalized to the official spelling/casing.
    const cleanName = matchAllowedTeamName(rawName);
    if (!cleanName) {
      setError("That's not a registered team name. Check the spelling and try again.");
      return;
    }

    setBusy(true);
    try {
      const roomSnap = await get(child(ref(db), `rooms/${cleanPin}`));
      if (!roomSnap.exists()) {
        setError("PIN not found. Check with the host.");
        setBusy(false);
        return;
      }
      const roomVal = roomSnap.val();
      const existingTeams = roomVal.teams || {};
      const existingList = Object.values(existingTeams);

      const nameTaken = existingList.some(
        (t) => (t?.name || "").trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (nameTaken) {
        setError("That team name is already taken. Pick a different one.");
        setBusy(false);
        return;
      }

      const teamId = makeTeamId();
      const color = colorForIndex(existingList.length);

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
      setError("Could not join. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <div className="wrap">
        <Brand tagline="Real-Time Team Quiz" />

        {mode === null && (
          <div className="card kahoot-home">
            <h2>Play or Host</h2>
            <p className="desc">
              Save quizzes, then host with a PIN. Same-time buzz → re-buzz those teams. Two together
              → first answers, second gets backup if wrong.
            </p>
            <div className="role-grid">
              <button className="role-btn host" onClick={() => { setMode("hostAuth"); setError(""); setHostPin(""); }}>
                Host — My Quizzes
              </button>
              <button className="role-btn" onClick={() => { setMode("join"); setError(""); }}>
                Enter PIN to Join
              </button>
            </div>
          </div>
        )}

        {mode === "hostAuth" && (
          <div className="card">
            <h2>Host Access</h2>
            <p className="desc">Enter the host PIN to manage quizzes and start a game.</p>
            <label>Host PIN</label>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter host PIN"
              className="pin-input"
              value={hostPin}
              onChange={(e) => setHostPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => { if (e.key === "Enter") submitHostPin(); }}
            />
            {error && <p className="small" style={{ color: "var(--wrong)" }}>{error}</p>}
            <div className="btn-row">
              <button className="btn ghost" onClick={() => { setMode(null); setError(""); }}>← Back</button>
              <button className="btn primary" onClick={submitHostPin}>Enter</button>
            </div>
          </div>
        )}

        {mode === "join" && (
          <div className="card">
            <h2>Join Game</h2>
            <p className="desc">Enter the 6-digit PIN shown on the host screen.</p>
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
            <select
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            >
              <option value="" disabled>Select your team</option>
              {ALLOWED_TEAM_NAMES.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <p className="small" style={{ marginTop: -6 }}>
              Choose your registered team name from the list.
            </p>
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
