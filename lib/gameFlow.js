import { asArray, BUZZ_SECS, ANSWER_SECS } from "@/lib/questions";

export function buildBuzzQueue(buzzes) {
  return Object.entries(buzzes || {})
    .filter(([, ts]) => typeof ts === "number")
    .sort((a, b) => a[1] - b[1])
    .map(([tid]) => tid);
}

export function clearQuestionTimers() {
  return {
    buzzDeadline: null,
    answerDeadline: null,
    buzzQueue: null,
    queueIndex: 0,
    buzzes: null,
    buzzedTeam: null,
    selectedOption: null,
    lastResult: null,
    tiedTeams: null,
  };
}

/** Start 10s buzz window — sab teams pe same deadline. */
export function startBuzzingPatch() {
  return {
    phase: "buzzing",
    buzzDeadline: Date.now() + BUZZ_SECS * 1000,
    answerDeadline: null,
    buzzQueue: null,
    queueIndex: 0,
    buzzedTeam: null,
    buzzes: null,
    selectedOption: null,
    lastResult: null,
    tiedTeams: null,
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
  };
}

/** Timeout / wrong → next buzz order (2nd, phir 3rd...). */
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

export function funnyBuzzLine(sec) {
  if (sec > 7) return "Finger ready? Smash that buzz!";
  if (sec > 4) return "Hurry — window closing…";
  if (sec > 1) return "Last seconds — GO!";
  return "Time's almost up…";
}

export function funnyAnswerLine(sec) {
  if (sec > 12) return "Think fast — but don't freeze!";
  if (sec > 6) return "Clock is ticking…";
  if (sec > 2) return "Tick-tock — pick something!";
  return "Almost out of time!";
}
