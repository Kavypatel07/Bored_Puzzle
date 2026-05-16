/* ════════════════════════════════════════════════════════
   script.js
   Bored Puzzle — 8-Tile Sliding Game with Live Ticker
   ════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════
   DOT-GRID CANVAS
   Reads --dot-char from CSS :root.
   Change --dot-char in style.css to any symbol.
   ════════════════════════════════════════ */
(function initDotGrid() {
  const cv  = document.getElementById('dot-cv');
  const ctx = cv.getContext('2d');
  const cs  = getComputedStyle(document.documentElement);

  // CSS custom property comes back as a quoted string e.g. "'·'" — strip quotes
  let rawChar = cs.getPropertyValue('--dot-char').trim().replace(/^['"]|['"]$/g, '');
  const CHAR  = rawChar || '·';
  const SIZE  = parseFloat(cs.getPropertyValue('--dot-size'))      || 20;
  const COLOR = cs.getPropertyValue('--dot-color').trim()           || 'rgba(0,0,0,0.28)';
  const FS    = parseFloat(cs.getPropertyValue('--dot-font-size')) || 13;

  function draw() {
    cv.width  = window.innerWidth;
    cv.height = Math.max(document.body.scrollHeight, window.innerHeight);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle    = COLOR;
    ctx.font         = `${FS}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    for (let y = SIZE / 2; y < cv.height; y += SIZE)
      for (let x = SIZE / 2; x < cv.width; x += SIZE)
        ctx.fillText(CHAR, x, y);
  }

  draw();
  window.addEventListener('resize', draw);
  new ResizeObserver(draw).observe(document.body);
})();


/* ════════════════════════════════════════
   TICKER
   — Fetches facts/jokes/quotes/trivia from API Ninjas
   — Stores every item in localStorage (pool grows over time)
   — Falls back to stored pool silently if API is offline
   ════════════════════════════════════════ */
const POOL_KEY = 'boredTicker_v3';

/*
  API key is injected by config.js (auto-generated from .env — never committed to git).
  If config.js is missing or the key is blank, the app silently falls back to
  the localStorage seed pool — users see no error either way.
  See README.md → "API Setup" for how to generate config.js from your .env file.
*/
const API_KEY = (typeof window !== 'undefined' && window.ENV && window.ENV.API_NINJAS_KEY)
  ? window.ENV.API_NINJAS_KEY
  : '';

// Built-in seed pool — works with zero API calls
const SEED = [
  "A group of jellyfish is called a smack.",
  "A group of flamingos is called a flamboyance.",
  "A group of owls is called a parliament.",
  "A group of pandas is called an embarrassment.",
  "A snail can sleep for three years straight.",
  "Honey never spoils — 3000-year-old honey was found in Egyptian tombs.",
  "Octopuses have three hearts and blue blood.",
  "A day on Venus is longer than a year on Venus.",
  "Bananas are technically berries, but strawberries are not.",
  "The Eiffel Tower grows 15 cm taller in summer due to heat expansion.",
  "Cleopatra lived closer in time to the Moon landing than to the pyramids.",
  "Crows can recognise human faces and hold grudges for years.",
  "There are more possible chess games than atoms in the observable universe.",
  "The shortest war in history lasted just 38 minutes — Anglo-Zanzibar War, 1896.",
  "A bolt of lightning is five times hotter than the surface of the Sun.",
  "Wombats produce cube-shaped droppings to mark their territory.",
  "Sharks are older than trees — they've existed for over 450 million years.",
  "The human brain uses about 20% of the body's total energy.",
  "Sea otters hold hands while sleeping so they don't drift apart.",
  "Two diseases have been fully eradicated: smallpox and rinderpest.",
  "Why don't scientists trust atoms? Because they make up everything.",
  "I told my wife she was drawing her eyebrows too high. She looked surprised.",
  "What do you call cheese that isn't yours? Nacho cheese.",
  "I used to hate facial hair — but then it grew on me.",
  "I'm reading a book about anti-gravity. It's impossible to put down.",
  "Why did the bicycle fall over? Because it was two-tired.",
  "What do you call a fish without eyes? A fsh.",
  "Why did the scarecrow win an award? He was outstanding in his field.",
];

/** Load pool from localStorage, fall back to SEED */
function loadPool() {
  try {
    const raw = localStorage.getItem(POOL_KEY);
    return raw ? JSON.parse(raw) : [...SEED];
  } catch {
    return [...SEED];
  }
}

/** Persist pool to localStorage */
function savePool(pool) {
  try { localStorage.setItem(POOL_KEY, JSON.stringify(pool)); } catch {}
}

/** Merge new items into pool, deduplicating by lowercase trim */
function mergePool(items) {
  const pool = loadPool();
  const seen = new Set(pool.map(s => s.trim().toLowerCase()));
  for (const t of items) {
    const c = t.trim();
    if (c && !seen.has(c.toLowerCase())) {
      pool.push(c);
      seen.add(c.toLowerCase());
    }
  }
  savePool(pool);
  return pool;
}

/** Render ticker track — doubles items so the loop is seamless */
function buildTicker(pool) {
  const track = document.getElementById('tickerTrack');
  const items = [...pool].sort(() => Math.random() - 0.5);
  track.innerHTML = [...items, ...items]
    .map(t => `<span class="ticker-item">${esc(t)}</span>`)
    .join('');
}

/** HTML-escape a string */
function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Update the small status line below the card */
function setStatus(msg) {
  const el = document.getElementById('tickerStatus');
  if (el) el.textContent = msg;
}

/** Fetch a random category from API Ninjas.
 *  Throws if API_KEY is missing — caller catches and uses pool fallback. */
async function fetchFresh() {
  if (!API_KEY) throw new Error('No API key — using seed pool');

  const endpoints = [
    { u: 'https://api.api-ninjas.com/v1/facts',  fn: r => r.map(x => x.fact) },
    { u: 'https://api.api-ninjas.com/v1/jokes',  fn: r => r.map(x => x.joke) },
    { u: 'https://api.api-ninjas.com/v1/quotes', fn: r => r.map(x => `"${x.quote}" — ${x.author}`) },
    { u: 'https://api.api-ninjas.com/v1/trivia', fn: r => r.map(x => `${x.question} — ${x.answer}`) },
  ];
  const ep  = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = await fetch(ep.u, { headers: { 'X-Api-Key': API_KEY } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return ep.fn(await res.json());
}

/** Boot ticker: show stored pool immediately, then fetch live data */
async function initTicker() {
  let pool = loadPool();
  buildTicker(pool);

  if (!API_KEY) {
    setStatus(`No API key — showing ${pool.length} stored items · hover yellow bar to pause`);
  } else {
    setStatus(`${pool.length} items in pool — hover yellow bar to pause`);
  }

  try {
    pool = mergePool(await fetchFresh()); // mergePool returns the full updated pool
    buildTicker(pool);                    // rebuild ticker with new items immediately
    setStatus(`✓ Live — ${pool.length} items · hover yellow bar to pause`);
  } catch {
    setStatus(`Stored pool (${pool.length} items) · hover yellow bar to pause`);
  }

  // Refresh every 2 min — always rebuild ticker + sync status count
  setInterval(async () => {
    try {
      const updatedPool = mergePool(await fetchFresh());
      buildTicker(updatedPool);
      setStatus(`✓ Live — ${updatedPool.length} items · hover yellow bar to pause`);
    } catch {}
  }, 120_000);
}


/* ════════════════════════════════════════
   8-PUZZLE GAME
   ════════════════════════════════════════ */
const GOAL      = [1, 2, 3, 4, 5, 6, 7, 8, 0]; // solved state
const STATS_KEY = 'boredPuzzle_stats_v1';

// Active board state — boardSnapshot holds the unmodified starting layout
// so Reset can restore it without generating a new puzzle
let board         = [];
let boardSnapshot = [];
let moves         = 0;
let seconds       = 0;
let timerOn       = false;
let tInterval     = null;
let solved        = false;
let gameIndex     = 0; // increments each time nextGame() is called


/* ── Seeded shuffle (LCG) ─────────────────────────── */
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = ((s * 1664525 + 1013904223) >>> 0);
    const j = (s >>> 0) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Solvability check (inversion count parity) ───── */
function solvable(arr) {
  const flat = arr.filter(x => x !== 0);
  let inv = 0;
  for (let i = 0; i < flat.length; i++)
    for (let j = i + 1; j < flat.length; j++)
      if (flat[i] > flat[j]) inv++;
  return inv % 2 === 0;
}

/* ── Goal check ───────────────────────────────────── */
function eqGoal(a) {
  return a.every((v, i) => v === GOAL[i]);
}

/* ── Build deterministic board from a seed ─────────── */
function makeBoardFromSeed(seed) {
  let s = seed, r;
  do {
    r = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8, 0], s++);
  } while (!solvable(r) || eqGoal(r));
  return r;
}

/* ── Date-based base seed (same puzzle = same date) ── */
function baseSeed() {
  const d = new Date();
  return (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) * 1000;
}


/* ── Timer ────────────────────────────────────────── */
function stopTimer() {
  clearInterval(tInterval);
  tInterval = null;
  timerOn   = false;
}

function startTimer() {
  timerOn   = true;
  tInterval = setInterval(() => { seconds++; updateBtns(); }, 1000);
}

function updateBtns() {
  document.getElementById('timerBtn').textContent = `⏱ ${seconds}s`;
  document.getElementById('movesBtn').textContent = `🎯 ${moves} Moves`;
}


/* ── RESET — restores current puzzle to its starting layout ── */
function resetTimer() {
  stopTimer();
  board   = [...boardSnapshot]; // put tiles back to initial positions
  moves   = 0;
  seconds = 0;
  solved  = false;
  document.getElementById('winOverlay').classList.remove('show');
  document.getElementById('hintBox').classList.remove('show');
  updateBtns();
  render();
}

/* ── NEW — advances to the next sequential puzzle ──── */
function nextGame() {
  stopTimer();
  gameIndex++;
  boardSnapshot = makeBoardFromSeed(baseSeed() + gameIndex);
  board         = [...boardSnapshot];
  moves         = 0;
  seconds       = 0;
  solved        = false;
  document.getElementById('winOverlay').classList.remove('show');
  document.getElementById('hintBox').classList.remove('show');
  updateBtns();
  render();
}

/* ── First load ───────────────────────────────────── */
function initGame() {
  boardSnapshot = makeBoardFromSeed(baseSeed() + gameIndex);
  board         = [...boardSnapshot];
  moves         = 0;
  seconds       = 0;
  solved        = false;
  updateBtns();
  render();
}


/* ── Render board to DOM ──────────────────────────── */
function render() {
  const el = document.getElementById('board');
  el.innerHTML = '';
  board.forEach((v, i) => {
    const t = document.createElement('div');
    t.className   = 'tile' + (v === 0 ? ' empty' : '');
    t.textContent = v || '';
    if (v) t.onclick = () => tryMove(i);
    el.appendChild(t);
  });
}


/* ── Handle a tile click ──────────────────────────── */
function tryMove(idx) {
  if (solved) return;

  const ei = board.indexOf(0);
  const rowDiff = Math.abs(Math.floor(idx / 3) - Math.floor(ei / 3));
  const colDiff = Math.abs(idx % 3 - ei % 3);
  if (rowDiff + colDiff !== 1) return; // not adjacent to empty space

  if (!timerOn) startTimer();

  // Swap tile with empty space
  [board[idx], board[ei]] = [board[ei], board[idx]];
  moves++;
  updateBtns();
  render();

  // Pop animation on the tile that just landed in the empty slot
  const tiles = document.querySelectorAll('.tile');
  if (tiles[ei]) {
    tiles[ei].classList.remove('pop');
    void tiles[ei].offsetWidth; // force reflow to restart animation
    tiles[ei].classList.add('pop');
  }

  // Check win
  if (eqGoal(board)) {
    stopTimer();
    solved = true;
    setTimeout(winGame, 300);
    persistWin();
  }
}


/* ── Show win overlay ─────────────────────────────── */
function winGame() {
  document.getElementById('winSub').textContent = `${moves} moves · ${seconds}s`;
  document.getElementById('winOverlay').classList.add('show');
}


/* ── Stats — localStorage ─────────────────────────── */
function loadRawStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : { solved: 0, bestTime: null, bestMoves: null };
  } catch {
    return { solved: 0, bestTime: null, bestMoves: null };
  }
}

function saveRawStats(s) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {}
}

/** Called on every win — update solved count and personal records */
function persistWin() {
  const s = loadRawStats();
  s.solved = (s.solved || 0) + 1;
  if (s.bestTime  === null || seconds < s.bestTime)  s.bestTime  = seconds;
  if (s.bestMoves === null || moves   < s.bestMoves) s.bestMoves = moves;
  saveRawStats(s);
  renderStats(s);
}

/** Read stats from localStorage and paint them into the UI */
function loadStats() {
  renderStats(loadRawStats());
}

function renderStats(s) {
  document.getElementById('solvedVal').textContent    = s.solved || 0;
  document.getElementById('bestTimeVal').textContent  = s.bestTime  !== null ? `${s.bestTime}s`  : '—';
  document.getElementById('bestMovesVal').textContent = s.bestMoves !== null ? `${s.bestMoves}`  : '—';
}


/* ════════════════════════════════════════
   A* HINT SOLVER
   Manhattan-distance heuristic, depth-capped at 32
   ════════════════════════════════════════ */
function showHint() {
  const box = document.getElementById('hintBox');

  if (eqGoal(board)) {
    box.textContent = '✓ Already solved!';
    box.classList.add('show');
    return;
  }

  const solution = aStar([...board]);
  if (!solution) {
    box.textContent = '⚠ Could not find path — try resetting.';
    box.classList.add('show');
    return;
  }

  const nextIdx  = solution[0];
  const tileVal  = board[nextIdx];
  box.textContent = `💡 ${solution.length} moves left. Slide tile ${tileVal} toward the empty space.`;
  box.classList.add('show');
  setTimeout(() => box.classList.remove('show'), 5000);
}

function aStar(start) {
  // Heuristic: sum of Manhattan distances for each tile
  const h = s => s.reduce((acc, v, i) => {
    if (!v) return acc;
    const gi = GOAL.indexOf(v);
    return acc + Math.abs(Math.floor(i / 3) - Math.floor(gi / 3)) + Math.abs(i % 3 - gi % 3);
  }, 0);

  const key = s => s.join(',');
  const pq  = [{ s: start, path: [], g: 0, f: h(start) }];
  const vis = new Map();

  while (pq.length) {
    // Sort ascending by f (g + h) — smallest f first
    pq.sort((a, b) => a.f - b.f);
    const cur = pq.shift();
    const k   = key(cur.s);

    if (vis.has(k)) continue;
    vis.set(k, 1);

    if (eqGoal(cur.s)) return cur.path;
    if (cur.g > 32) continue; // depth cap keeps UI responsive

    const ei = cur.s.indexOf(0);
    const rr = Math.floor(ei / 3);
    const cc = ei % 3;
    const neighbours = [];
    if (rr > 0) neighbours.push(ei - 3);
    if (rr < 2) neighbours.push(ei + 3);
    if (cc > 0) neighbours.push(ei - 1);
    if (cc < 2) neighbours.push(ei + 1);

    for (const ni of neighbours) {
      const ns = [...cur.s];
      [ns[ei], ns[ni]] = [ns[ni], ns[ei]];
      if (!vis.has(key(ns))) {
        const g = cur.g + 1;
        pq.push({ s: ns, path: [...cur.path, ni], g, f: g + h(ns) });
      }
    }
  }

  return null; // no solution found within depth cap
}


/* ════════════════════════════════════════
   BOOT
   ════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initGame();
  loadStats();
  initTicker();
});
