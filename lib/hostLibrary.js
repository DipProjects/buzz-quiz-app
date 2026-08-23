import { ref, set, get, update, remove, push, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import { DEFAULT_ROUNDS, normalizeRounds, randPin, countItems } from "@/lib/questions";

const HOST_KEY = "buzzquiz_hostId";

export function getHostId() {
  if (typeof window === "undefined") return null;
  let id = localStorage.getItem(HOST_KEY);
  if (!id) {
    id = "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    localStorage.setItem(HOST_KEY, id);
  }
  return id;
}

export function quizzesPath(hostId) {
  return `hosts/${hostId}/quizzes`;
}

export function quizPath(hostId, quizId) {
  return `hosts/${hostId}/quizzes/${quizId}`;
}

export async function listQuizzes(hostId) {
  const snap = await get(ref(db, quizzesPath(hostId)));
  if (!snap.exists()) return [];
  const val = snap.val();
  return Object.entries(val)
    .map(([id, q]) => ({
      id,
      title: q.title || "Untitled Quiz",
      rounds: normalizeRounds(q.rounds),
      updatedAt: q.updatedAt || 0,
      createdAt: q.createdAt || 0,
    }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function watchQuizzes(hostId, cb) {
  const r = ref(db, quizzesPath(hostId));
  return onValue(r, (snap) => {
    if (!snap.exists()) {
      cb([]);
      return;
    }
    const val = snap.val();
    const list = Object.entries(val)
      .map(([id, q]) => ({
        id,
        title: q.title || "Untitled Quiz",
        rounds: normalizeRounds(q.rounds),
        updatedAt: q.updatedAt || 0,
        createdAt: q.createdAt || 0,
        itemCount: countItems(normalizeRounds(q.rounds)),
        roundCount: normalizeRounds(q.rounds).length,
      }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    cb(list);
  });
}

export async function createQuiz(hostId, title = "My Quiz") {
  const r = push(ref(db, quizzesPath(hostId)));
  const now = Date.now();
  const data = {
    title: title.trim() || "My Quiz",
    rounds: DEFAULT_ROUNDS,
    createdAt: now,
    updatedAt: now,
  };
  await set(r, data);
  return r.key;
}

export async function loadQuiz(hostId, quizId) {
  const snap = await get(ref(db, quizPath(hostId, quizId)));
  if (!snap.exists()) return null;
  const q = snap.val();
  return {
    id: quizId,
    title: q.title || "Untitled Quiz",
    rounds: normalizeRounds(q.rounds),
    updatedAt: q.updatedAt || 0,
    createdAt: q.createdAt || 0,
  };
}

export async function saveQuiz(hostId, quizId, { title, rounds }) {
  await update(ref(db, quizPath(hostId, quizId)), {
    title: (title || "Untitled Quiz").trim() || "Untitled Quiz",
    rounds: normalizeRounds(rounds),
    updatedAt: Date.now(),
  });
}

export async function deleteQuiz(hostId, quizId) {
  await remove(ref(db, quizPath(hostId, quizId)));
}

/** Kahoot-style: quiz library se live game PIN banao. Questions quiz mein hi rehte hain. */
export async function hostLiveGame(hostId, quiz) {
  const rounds = normalizeRounds(quiz.rounds);
  if (countItems(rounds) === 0) {
    throw new Error("EMPTY_QUIZ");
  }
  let pin = randPin();
  for (let i = 0; i < 5; i++) {
    const exists = await get(ref(db, `rooms/${pin}`));
    if (!exists.exists()) break;
    pin = randPin();
  }
  await set(ref(db, `rooms/${pin}`), {
    phase: "lobby",
    roundIdx: 0,
    idx: 0,
    rounds,
    quizId: quiz.id || null,
    quizTitle: quiz.title || "Quiz",
    hostId,
    buzzedTeam: null,
    buzzes: null,
    buzzQueue: null,
    queueIndex: 0,
    buzzDeadline: null,
    answerDeadline: null,
    tiedTeams: null,
    selectedOption: null,
    lastResult: null,
    scores: {},
    teams: {},
    createdAt: Date.now(),
  });
  return pin;
}
