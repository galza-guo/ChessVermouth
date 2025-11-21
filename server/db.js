const fs = require('fs');
const path = require('path');

// Simple JSON store for games and moves with atomic writes.
// Shape:
// {
//   games: {
//     [id]: {
//       id, createdAt, updatedAt,
//       status: 'active' | 'finished',
//       variant: 'standard',
//       players: { hostName: string|null, opponentName: string|null },
//       startFEN: string,
//       fen: string,
//       pgn: string,
//       clocks: { whiteMs: number, blackMs: number },
//       moves: Array<{ ply: number, uci: string, san: string, fenAfter: string, ts: string }>,
//       result?: '1-0' | '0-1' | '1/2-1/2',
//       finishedAt?: string
//     }
//   },
//   counters: { 'YYYY.MM.DD': number }
// }

const dataDir = path.resolve(__dirname, '../data');
const dbPath = path.join(dataDir, 'games.json');
const tmpPath = path.join(dataDir, 'games.json.tmp');

let db = { games: {}, counters: {} };
let loaded = false;

function ensureDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function init() {
  ensureDir();
  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') db = parsed;
    } catch (e) {
      // keep empty db on parse error
    }
  } else {
    flush();
  }
  loaded = true;
}

function flush() {
  // Atomic write: write temp then rename
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmpPath, dbPath);
  } catch (e) {
    // best-effort; ignore
  }
}

function dateKeyFor(d) {
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}.${mm}.${dd}`;
}

function generateGameId(now = new Date()) {
  if (!loaded) init();
  const key = dateKeyFor(now);
  let idx = (db.counters[key] || 0) + 1;
  // ensure uniqueness if file was edited
  let id = `${key}(${String(idx).padStart(2, '0')})`;
  while (db.games[id]) {
    idx += 1;
    id = `${key}(${String(idx).padStart(2, '0')})`;
  }
  db.counters[key] = idx;
  flush();
  return id;
}

function createGameRecord({ id, startFEN = 'startpos', variant = 'standard' }) {
  if (!loaded) init();
  const now = new Date().toISOString();
  const rec = {
    id,
    createdAt: now,
    updatedAt: now,
    status: 'active',
    variant,
    players: { hostName: null, opponentName: null },
    startFEN,
    fen: startFEN === 'startpos' ? 'startpos' : startFEN,
    pgn: '',
    clocks: { whiteMs: 0, blackMs: 0 },
    moves: [],
  };
  db.games[id] = rec;
  flush();
  return rec;
}

function getGame(id) {
  if (!loaded) init();
  return db.games[id] || null;
}

function listUnfinished() {
  if (!loaded) init();
  return Object.values(db.games).filter((g) => g.status !== 'finished');
}

function listGames(options = {}) {
  if (!loaded) init();
  const status = options.status || 'all';
  let items = Object.values(db.games);
  if (status === 'finished') {
    items = items.filter((g) => g.status === 'finished');
  } else if (status === 'active') {
    items = items.filter((g) => g.status !== 'finished');
  }
  items.sort((a, b) => {
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });
  return items.map((g) => ({ ...g }));
}

function appendMove(id, { ply, uci, san, fenAfter, ts }) {
  const g = getGame(id);
  if (!g) throw new Error('game not found');
  g.moves.push({ ply, uci, san, fenAfter, ts });
  g.fen = fenAfter;
  g.pgn = g.pgn || '';
  g.updatedAt = ts;
  flush();
}

function updateSnapshot(id, { fen, pgn, clocks, moves }) {
  const g = getGame(id);
  if (!g) throw new Error('game not found');
  if (typeof fen === 'string') g.fen = fen;
  if (typeof pgn === 'string') g.pgn = pgn;
  if (clocks && typeof clocks === 'object') {
    const c = { ...g.clocks };
    if (Number.isFinite(clocks.whiteMs)) c.whiteMs = clocks.whiteMs;
    if (Number.isFinite(clocks.blackMs)) c.blackMs = clocks.blackMs;
    g.clocks = c;
  }
  if (Array.isArray(moves)) {
    g.moves = moves.map((m, idx) => ({
      ply: typeof m.ply === 'number' ? m.ply : idx + 1,
      uci: m.uci || '',
      san: m.san || '',
      fenAfter: m.fenAfter || undefined,
      ts: m.ts || new Date().toISOString()
    }));
  }
  g.updatedAt = new Date().toISOString();
  flush();
}

function finishGame(id, result) {
  const g = getGame(id);
  if (!g) throw new Error('game not found');
  g.status = 'finished';
  g.result = result;
  g.finishedAt = new Date().toISOString();
  g.updatedAt = g.finishedAt;
  flush();
}

function deleteGame(id) {
  if (db.games[id]) {
    delete db.games[id];
    flush();
  }
}

function setPlayerName(id, seat, name) {
  const g = getGame(id);
  if (!g) return;
  if (!g.players) g.players = { hostName: null, opponentName: null };
  if (seat === 'host') g.players.hostName = name;
  else if (seat === 'opponent') g.players.opponentName = name;
  g.updatedAt = new Date().toISOString();
  flush();
}

module.exports = {
  init,
  flush,
  generateGameId,
  createGameRecord,
  getGame,
  listUnfinished,
  listGames,
  appendMove,
  updateSnapshot,
  finishGame,
  deleteGame,
  setPlayerName,
};
