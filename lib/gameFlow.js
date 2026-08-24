import { ANSWER_SECS, TIE_WINDOW_MS } from "@/lib/questions";

/** Buzz timestamps sorted earliest → latest. */
export function sortedBuzzIds(buzzes) {
  return Object.entries(buzzes || {})
    .filter(([, ts]) => typeof ts === "number")
    .sort((a, b) => a[1] - b[1])
    .map(([tid]) => tid);
}

/** @deprecated use sortedBuzzIds */
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
    buzzes: null,
    buzzedTeam: null,
    selectedOption: null,
    lastResult: null,
    tiedTeams: null,
    tieStartedAt: null,
    eliminatedTeams: null,
    answerLock: null,
    answerLineup: null,
    answerSlot: 0,
  };
}

export function startBuzzingPatch() {
  return {
    phase: "buzzing",
    ...clearQuestionTimers(),
  };
}

export function startMediaPatch() {
  return {
    phase: "question",
    ...clearQuestionTimers(),
  };
}

/** Open answering for one team, with optional backup lineup from same buzz window. */
export function openAnsweringWithLineup(lineup, slot = 0, tiedTeams = null) {
  const teamId = lineup?.[slot];
  if (!teamId) {
    return {
      phase: "reveal",
      lastResult: "nobody",
      buzzedTeam: null,
      answerDeadline: null,
      selectedOption: null,
      buzzResolveAt: null,
      tiedTeams: null,
      tieStartedAt: null,
      buzzes: null,
      answerLock: null,
      answerLineup: null,
      answerSlot: 0,
    };
  }
  return {
    phase: "answering",
    buzzedTeam: teamId,
    answerLineup: lineup,
    answerSlot: slot,
    tiedTeams: tiedTeams || null,
    answerDeadline: Date.now() + ANSWER_SECS * 1000,
    selectedOption: null,
    lastResult: null,
    buzzResolveAt: null,
    tieStartedAt: null,
    buzzes: null,
    answerLock: null,
  };
}

export function openAnsweringPatch(teamId) {
  return openAnsweringWithLineup(teamId ? [teamId] : [], 0);
}

/** Re-buzz round for tied teams only. */
export function tiebreakPatch(tiedTeamIds) {
  return {
    phase: "tiebreak",
    tiedTeams: tiedTeamIds,
    buzzes: null,
    buzzResolveAt: null,
    buzzedTeam: null,
    answerDeadline: null,
    selectedOption: null,
    lastResult: null,
    tieStartedAt: Date.now(),
    answerLineup: null,
    answerSlot: 0,
    answerLock: null,
  };
}

/**
 * Resolve collected buzzes.
 * - buzzing + 1 hit → answer
 * - buzzing + 2+ same-time → tiebreak (re-buzz those teams)
 * - tiebreak + 1 hit → answer
 * - tiebreak + 2+ same-time → tiebreak again among those (keeps re-buzzing
 *   until exactly one team lands a clean buzz, so the re-buzz screen always
 *   shows up when multiple teams buzz together, not just the first time)
 */
export function resolveBuzzOrTiePatch(buzzes, { phase = "buzzing", allowedIds = null, prevTiedTeams = null } = {}) {
  const tied = teamsWithinTieWindow(buzzes, allowedIds);
  if (tied.length === 0) return null;

  if (tied.length === 1) {
    return openAnsweringWithLineup(tied, 0, prevTiedTeams || allowedIds || null);
  }

  return tiebreakPatch(tied);
}

/** Who answers after a wrong / timeout — backup from same buzz pair, else re-buzz tied pool. */
export function failAnswerPatch(live, failedTeamId) {
  const eliminated = { ...(live.eliminatedTeams || {}) };
  if (failedTeamId) eliminated[failedTeamId] = true;

  const lineup = asLineup(live.answerLineup);
  const slot = live.answerSlot ?? 0;
  const nextSlot = slot + 1;

  if (lineup.length > nextSlot) {
    const nextTeam = lineup[nextSlot];
    if (nextTeam && !eliminated[nextTeam]) {
      return {
        ...openAnsweringWithLineup(lineup, nextSlot, live.tiedTeams || null),
        eliminatedTeams: eliminated,
        selectedOption: null,
        lastResult: null,
        answerLock: null,
      };
    }
  }

  const pool = asLineup(live.tiedTeams).filter((tid) => !eliminated[tid]);
  if (pool.length > 0) {
    return {
      ...tiebreakPatch(pool),
      eliminatedTeams: eliminated,
      selectedOption: live.selectedOption ?? null,
      lastResult: live.lastResult === "timeout" ? "timeout" : "wrong",
      buzzedTeam: failedTeamId || live.buzzedTeam,
      answerLock: null,
    };
  }

  return {
    ...startBuzzingPatch(),
    eliminatedTeams: eliminated,
    selectedOption: live.selectedOption ?? null,
    lastResult: live.lastResult === "timeout" ? "timeout" : "wrong",
    buzzedTeam: failedTeamId || live.buzzedTeam,
  };
}

export function reopenBuzzAfterFailPatch(failedTeamId, prevEliminated = null) {
  const eliminated = { ...(prevEliminated || {}) };
  if (failedTeamId) eliminated[failedTeamId] = true;
  return {
    phase: "buzzing",
    buzzDeadline: null,
    buzzResolveAt: null,
    answerDeadline: null,
    buzzes: null,
    buzzedTeam: failedTeamId || null,
    selectedOption: null,
    tiedTeams: null,
    tieStartedAt: null,
    answerLock: null,
    answerLineup: null,
    answerSlot: 0,
    eliminatedTeams: eliminated,
  };
}

export function reopenBuzzPatch() {
  return { ...startBuzzingPatch() };
}

export function asLineup(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  return [v];
}

export function lineupLabel(lineup, slot, teams = {}) {
  const list = asLineup(lineup);
  if (!list.length) return null;
  const now = list[slot] ? teams[list[slot]]?.name || "Team" : null;
  const next = list[slot + 1] ? teams[list[slot + 1]]?.name || "Team" : null;
  return { now, next, list, slot };
}

export function funnyAnswerLine(sec) {
  if (sec > 10) return "Think fast — but don't freeze!";
  if (sec > 5) return "Clock is ticking…";
  if (sec > 2) return "Tick-tock — pick something!";
  return "Almost out of time!";
}
