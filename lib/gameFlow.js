import { ANSWER_SECS, TIE_WINDOW_MS } from "@/lib/questions";

/** Buzz timestamps sorted earliest → latest (display only — not a handoff queue). */
export function sortedBuzzIds(buzzes) {
  return Object.entries(buzzes || {})
    .filter(([, ts]) => typeof ts === "number")
    .sort((a, b) => a[1] - b[1])
    .map(([tid]) => tid);
}

/** @deprecated use sortedBuzzIds — kept so old imports don't break mid-deploy */
export const buildBuzzQueue = sortedBuzzIds;

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
    eliminatedTeams: null,
    answerLock: null,
  };
}

/** Open buzzer for everyone still eligible this question. */
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

/** Single team answers — nobody else waiting in line. */
export function openAnsweringPatch(teamId) {
  if (!teamId) {
    return {
      phase: "reveal",
      lastResult: "nobody",
      buzzedTeam: null,
      answerDeadline: null,
      selectedOption: null,
      buzzQueue: null,
      queueIndex: 0,
      buzzResolveAt: null,
      tiedTeams: null,
      tieStartedAt: null,
      buzzes: null,
      answerLock: null,
    };
  }
  return {
    phase: "answering",
    buzzedTeam: teamId,
    buzzQueue: null,
    queueIndex: 0,
    answerDeadline: Date.now() + ANSWER_SECS * 1000,
    selectedOption: null,
    lastResult: null,
    buzzResolveAt: null,
    tiedTeams: null,
    tieStartedAt: null,
    answerLock: null,
  };
}

/**
 * 1 clear winner → they answer.
 * 2+ near-simultaneous → immediate tiebreak (only those teams re-buzz).
 */
export function resolveBuzzOrTiePatch(buzzes, { allowedIds = null } = {}) {
  const tied = teamsWithinTieWindow(buzzes, allowedIds);
  if (tied.length === 0) return null;

  if (tied.length === 1) {
    return openAnsweringPatch(tied[0]);
  }

  return {
    phase: "tiebreak",
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
    answerLock: null,
  };
}

/**
 * Wrong / timeout: reopen buzz, but lock out the team that just failed
 * so they cannot answer the same question again.
 */
export function reopenBuzzAfterFailPatch(failedTeamId, prevEliminated = null) {
  const eliminated = { ...(prevEliminated || {}) };
  if (failedTeamId) eliminated[failedTeamId] = true;
  return {
    phase: "buzzing",
    buzzDeadline: null,
    buzzResolveAt: null,
    answerDeadline: null,
    buzzQueue: null,
    queueIndex: 0,
    buzzes: null,
    buzzedTeam: failedTeamId || null,
    selectedOption: null,
    tiedTeams: null,
    tieStartedAt: null,
    answerLock: null,
    eliminatedTeams: eliminated,
  };
}

export function reopenBuzzPatch() {
  return {
    ...startBuzzingPatch(),
  };
}

export function funnyAnswerLine(sec) {
  if (sec > 10) return "Think fast — but don't freeze!";
  if (sec > 5) return "Clock is ticking…";
  if (sec > 2) return "Tick-tock — pick something!";
  return "Almost out of time!";
}
