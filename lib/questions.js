export const DEFAULT_QUESTIONS = [
  { q: "What is the capital of India?", options: ["Mumbai", "New Delhi", "Kolkata", "Chennai"], correct: 1, img: "", video: "" },
  { q: "Which is the largest ocean in the world?", options: ["Atlantic", "Indian Ocean", "Pacific", "Arctic"], correct: 2, img: "", video: "" },
  { q: "In which city is the Taj Mahal located?", options: ["Agra", "Jaipur", "Lucknow", "Delhi"], correct: 0, img: "", video: "" },
];

export const DEFAULT_ROUNDS = [
  { name: "Round 1", type: "quiz", questions: [] },
];

/** Firebase sometimes returns arrays as objects { "0": ..., "1": ... }. */
export function asArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return Object.keys(val)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => val[k])
    .filter((x) => x != null);
}

export function normalizeRounds(rounds) {
  return asArray(rounds).map((r) => ({
    ...r,
    type: r?.type || "quiz",
    name: r?.name || "Round",
    questions: asArray(r?.questions).map((q) => {
      if (!q || typeof q !== "object") return q;
      const media = asArray(q.media);
      return media.length ? { ...q, media } : q;
    }),
  }));
}

export function emptyMediaItem() {
  return { caption: "", media: [] };
}

/** Normalize legacy img/video fields + new media[] into one list. */
export function normalizeMediaList(item) {
  if (!item) return [];
  if (Array.isArray(item.media) && item.media.length > 0) {
    return item.media.filter((m) => m && m.url);
  }
  const list = [];
  if (item.img) list.push({ kind: "image", url: item.img });
  if (item.video) list.push({ kind: "video", url: item.video });
  return list;
}

/** Pack media list back into storage shape (media[] + legacy img/video for old clients). */
export function packMediaFields(mediaList) {
  const media = (mediaList || []).filter((m) => m && m.url);
  const firstImg = media.find((m) => m.kind === "image");
  const firstVideo = media.find((m) => m.kind === "video");
  return {
    media,
    img: firstImg?.url || "",
    video: firstVideo?.url || "",
  };
}

export const POINTS_CORRECT = 1000;
export const POINTS_WRONG = -500;

/** No long buzz countdown — open until someone buzzes. */
export const BUZZ_SECS = null;
/** Seconds the current buzz-winner has to pick an answer. */
export const ANSWER_SECS = 20;
/** Near-simultaneous buzzes within this window count as a tie. */
export const TIE_WINDOW_MS = 400;
/** How long the "It's a tie!" banner shows before re-buzz opens. */
export const TIE_DISPLAY_MS = 1600;
/** Host can cap room size to one of these before starting. */


export const TEAM_PALETTE = [
  "#ff5c6c", "#4dabf7", "#ffd43b", "#33d17a", "#c084fc", "#ff922b",
  "#20c997", "#f06595", "#748ffc", "#e8590c",
];

export function colorForIndex(i) {
  return TEAM_PALETTE[i % TEAM_PALETTE.length];
}

export function ytEmbed(url) {
  if (!url) return "";
  const m = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}

export function resolveMedia(url) {
  if (!url) return null;
  const clean = url.trim();
  const yt = clean.match(/(?:youtu\.be\/|[?&]v=|youtube\.com\/shorts\/)([\w-]{11})/);
  if (yt) return { type: "youtube", src: `https://www.youtube.com/embed/${yt[1]}` };

  const ig = clean.match(/instagram\.com\/(?:reel|reels|p|tv)\/([\w-]+)/);
  if (ig) return { type: "instagram", src: `https://www.instagram.com/reel/${ig[1]}/embed` };

  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(clean)) return { type: "file-video", src: clean };

  return { type: "link", src: clean };
}

export function randCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

/** Kahoot-style 6-digit game PIN */
export function randPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function countItems(rounds) {
  return normalizeRounds(rounds).reduce((sum, r) => sum + (r.questions?.length || 0), 0);
}

export function makeTeamId() {
  return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function getStandings(scores, teams) {
  const rows = Object.entries(teams || {}).map(([tid, t]) => ({
    tid,
    name: t.name,
    color: t.color,
    points: (scores || {})[tid] || 0,
  }));
  rows.sort((a, b) => b.points - a.points);
  let rank = 0;
  let prevPoints = null;
  rows.forEach((row) => {
    if (row.points !== prevPoints) rank += 1;
    row.rank = rank;
    prevPoints = row.points;
  });
  return rows;
}

export function getWinnerRunnerUp(standings) {
  const winners = standings.filter((r) => r.rank === 1);
  const runnersUp = standings.filter((r) => r.rank === 2);
  return { winners, runnersUp };
}

/** Groups standings rows by podium rank (1st / 2nd / 3rd), ties included. */
export function getPodiumGroups(standings) {
  const groups = { 1: [], 2: [], 3: [] };
  (standings || []).forEach((row) => {
    if (row.rank >= 1 && row.rank <= 3) groups[row.rank].push(row);
  });
  return groups;
}

/**
 * Fixed, pre-registered team names. Only these (case-insensitive,
 * whitespace-trimmed) may join a room — anyone else is rejected at the door.
 */
export const ALLOWED_TEAM_NAMES = [
  "Jayshiv ke sher",
  "Swec Titans",
  "Wasser Warmth",
  "Team Udaan",
  "Mavricks",
  "Jewel Forever",
];

function foldName(s) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Case-insensitive lookup against ALLOWED_TEAM_NAMES.
 * Returns the canonical (correctly-cased) name if it matches, else null.
 */
export function matchAllowedTeamName(input) {
  const folded = foldName(input);
  if (!folded) return null;
  const hit = ALLOWED_TEAM_NAMES.find((n) => foldName(n) === folded);
  return hit || null;
}
