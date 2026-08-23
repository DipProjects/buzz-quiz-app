import { asArray, ANSWER_SECS, TIE_WINDOW_MS } from "@/lib/questions";

export function buildBuzzQueue(buzzes) {
  return Object.entries(buzzes || {})
    .filter(([, ts]) => typeof ts === "number")
    .sort((a, b) => a[1] - b[1])
    .map(([tid]) => tid);
}

/** Teams whose buzz landed within TIE_WINDOW_MS of the first buzz. */
export function teamsWithinTieWindow(buzzes, allowedIds = null) {
  let entries = Object.entries(buzzes || {})
    .filter(([, ts]) => typeof ts === "number")
    .sort((a, b) => a[1] - b[1]);
  if (allowedIds) {
    const allow = new Set(allowedIds);
    entries = entries.filter(([tid]) => allow.has(tid));
  }
  if (!entries.length) return [];
  const t0 = entries[0][1];
  return entries.filter(([, ts]) => ts - t0 <= TIE_WINDOW_MS).map(([tid]) => tid);
}

export function clearQuestionTimers() {
  return {
    buzzDeadline: null,
    buzzResolveAt: null,
    answerDeadline: null,
    buzzQueue: null,
    queueIndex: 0,
    buzzes: null,
    buzzedTeam: null,
    selectedOption: null,
    lastResult: null,
    tiedTeams: null,
    tieStartedAt: null,
  };
}

/** Open buzzer with no countdown. */
export function startBuzzingPatch() {
  return {
    phase: "buzzing",
    ...clearQuestionTimers(),
  };
}

/** Media round — no buzz/answer timers. */
export function startMediaPatch() {
  return {
    phase: "question",
    ...clearQuestionTimers(),
  };
}

export function openAnsweringPatch(queue, index = 0) {
  const q = asArray(queue);
  if (!q.length || index >= q.length) {
    return {
      phase: "reveal",
      lastResult: "nobody",
      buzzedTeam: null,
      answerDeadline: null,
      selectedOption: null,
      buzzQueue: q,
      queueIndex: index,
      buzzResolveAt: null,
      tiedTeams: null,
      tieStartedAt: null,
    };
  }
  return {
    phase: "answering",
    buzzQueue: q,
    queueIndex: index,
    buzzedTeam: q[index],
    answerDeadline: Date.now() + ANSWER_SECS * 1000,
    selectedOption: null,
    lastResult: null,
    buzzResolveAt: null,
    tiedTeams: null,
    tieStartedAt: null,
  };
}

/**
 * After the short collect window: 1 clear winner → answer;
 * 2+ near-simultaneous → tie (they must re-buzz).
 */
export function resolveBuzzOrTiePatch(buzzes, { lateQueue = true, allowedIds = null } = {}) {
  const tied = teamsWithinTieWindow(buzzes, allowedIds);
  if (tied.length === 0) return null;

  if (tied.length === 1) {
    const all = buildBuzzQueue(buzzes).filter((tid) => !allowedIds || allowedIds.includes(tid));
    const late = lateQueue ? all.filter((tid) => tid !== tied[0]) : [];
    return openAnsweringPatch([tied[0], ...late], 0);
  }

  return {
    phase: "tie",
    tiedTeams: tied,
    buzzes: null,
    buzzResolveAt: null,
    buzzedTeam: null,
    answerDeadline: null,
    selectedOption: null,
    lastResult: null,
    buzzQueue: null,
    queueIndex: 0,
    tieStartedAt: Date.now(),
  };
}

/** Timeout / wrong → next buzz order (2nd, then 3rd…). */
export function passToNextPatch(state) {
  const queue = asArray(state.buzzQueue);
  const next = (state.queueIndex || 0) + 1;
  if (next >= queue.length) {
    return {
      phase: "reveal",
      lastResult: "exhausted",
      answerDeadline: null,
      selectedOption: null,
      buzzedTeam: state.buzzedTeam || null,
      queueIndex: next,
    };
  }
  return openAnsweringPatch(queue, next);
}

export function funnyAnswerLine(sec) {
  if (sec > 10) return "Think fast — but don't freeze!";
  if (sec > 5) return "Clock is ticking…";
  if (sec > 2) return "Tick-tock — pick something!";
  return "Almost out of time!";
}
