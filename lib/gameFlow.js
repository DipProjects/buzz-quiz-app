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
    buzzAgainQuote: null,
  };
}

/** Funny one-liners shown when the floor reopens after a wrong / timed-out answer. */
const BUZZ_AGAIN_QUOTES = [
  "Floor's open again — don't overthink it!",
  "That answer just got yeeted. Your turn?",
  "Buzzer's reset. Redemption arc starts now.",
  "Plot twist! Anyone can steal this one.",
  "Wrong answer detected. Confidence still loading for someone else…",
  "The floor is lava. Also, it's open.",
  "Somebody's ego just took a hit. Yours could be next!",
  "Reset! Fastest thumbs win this time.",
  "That was a swing and a miss. Step up!",
];

export function pickBuzzAgainQuote() {
  return BUZZ_AGAIN_QUOTES[Math.floor(Math.random() * BUZZ_AGAIN_QUOTES.length)];
}

/** Shown when every team has been eliminated on a question and the floor resets for all. */
export const ALL_OUT_MESSAGE =
  "As no one could answer, all participants are getting a chance to attempt this question once again!";

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

/**
 * Who answers after a wrong / timeout — nobody gets auto-promoted from the
 * buzz queue. The failed team is eliminated for this question and the floor
 * reopens for every remaining (non-eliminated) team to buzz in fresh.
 *
 * If `allTeamIds` is passed and eliminating this team means every team in
 * the room is now out (no one left who could still buzz in), elimination
 * resets entirely so the floor reopens for everyone on this same question.
 */
export function failAnswerPatch(live, failedTeamId, allTeamIds = null) {
  const eliminated = { ...(live.eliminatedTeams || {}) };
  if (failedTeamId) eliminated[failedTeamId] = true;

  const ids = Array.isArray(allTeamIds) ? allTeamIds.filter(Boolean) : null;
  const allOut = !!(ids && ids.length > 0 && ids.every((tid) => eliminated[tid]));

  if (allOut) {
    return {
      ...startBuzzingPatch(),
      eliminatedTeams: null,
      selectedOption: live.selectedOption ?? null,
      lastResult: "allOut",
      buzzedTeam: failedTeamId || live.buzzedTeam,
      buzzAgainQuote: ALL_OUT_MESSAGE,
    };
  }

  return {
    ...startBuzzingPatch(),
    eliminatedTeams: eliminated,
    selectedOption: live.selectedOption ?? null,
    lastResult: live.lastResult === "timeout" ? "timeout" : "wrong",
    buzzedTeam: failedTeamId || live.buzzedTeam,
    buzzAgainQuote: pickBuzzAgainQuote(),
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
