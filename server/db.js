const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// SQLite database for games and moves
// Tables:
// - games: id, created_at, updated_at, status, variant, start_fen, fen, pgn, white_ms, black_ms, host_name, opponent_name, result, finished_at
// - moves: id, game_id, ply, uci, san, fen_after, ts
// - counters: date_key, count

const dataDir = path.resolve(__dirname, '../data');
const dbPath = path.join(dataDir, 'chess.db');
const legacyJsonPath = path.join(dataDir, 'games.json');

let db = null;

function ensureDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function init() {
  if (db) return;
  ensureDir();
  
  db = new Database(dbPath);
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      variant TEXT DEFAULT 'standard',
      start_fen TEXT DEFAULT 'startpos',
      fen TEXT DEFAULT 'startpos',
      pgn TEXT DEFAULT '',
      white_ms INTEGER DEFAULT 0,
      black_ms INTEGER DEFAULT 0,
      host_name TEXT,
      opponent_name TEXT,
      result TEXT,
      finished_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      ply INTEGER NOT NULL,
      uci TEXT NOT NULL,
      san TEXT,
      fen_after TEXT,
      ts TEXT NOT NULL,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_moves_game_id ON moves(game_id);
    
    CREATE TABLE IF NOT EXISTS counters (
      date_key TEXT PRIMARY KEY,
      count INTEGER DEFAULT 0
    );
  `);
  
  // Migrate from legacy JSON if it exists and DB is empty
  migrateFromJson();
}

function migrateFromJson() {
  if (!fs.existsSync(legacyJsonPath)) return;
  
  // Check if we already have data
  const gameCount = db.prepare('SELECT COUNT(*) as c FROM games').get().c;
  if (gameCount > 0) {
    // Already have data, don't migrate
    return;
  }
  
  try {
    const raw = fs.readFileSync(legacyJsonPath, 'utf8');
    const json = JSON.parse(raw);
    
    if (!json || typeof json !== 'object') return;
    
    console.log('[db] Migrating legacy JSON data to SQLite...');
    
    // Migrate games
    const insertGame = db.prepare(`
      INSERT INTO games (id, created_at, updated_at, status, variant, start_fen, fen, pgn, white_ms, black_ms, host_name, opponent_name, result, finished_at)
      VALUES (@id, @created_at, @updated_at, @status, @variant, @start_fen, @fen, @pgn, @white_ms, @black_ms, @host_name, @opponent_name, @result, @finished_at)
    `);
    
    const insertMove = db.prepare(`
      INSERT INTO moves (game_id, ply, uci, san, fen_after, ts)
      VALUES (@game_id, @ply, @uci, @san, @fen_after, @ts)
    `);
    
    const insertCounter = db.prepare(`
      INSERT OR REPLACE INTO counters (date_key, count)
      VALUES (@date_key, @count)
    `);
    
    const migrateAll = db.transaction(() => {
      // Migrate games
      if (json.games && typeof json.games === 'object') {
        for (const [id, g] of Object.entries(json.games)) {
          insertGame.run({
            id: id,
            created_at: g.createdAt || new Date().toISOString(),
            updated_at: g.updatedAt || new Date().toISOString(),
            status: g.status || 'active',
            variant: g.variant || 'standard',
            start_fen: g.startFEN || 'startpos',
            fen: g.fen || 'startpos',
            pgn: g.pgn || '',
            white_ms: g.clocks?.whiteMs || 0,
            black_ms: g.clocks?.blackMs || 0,
            host_name: g.players?.hostName || null,
            opponent_name: g.players?.opponentName || null,
            result: g.result || null,
            finished_at: g.finishedAt || null
          });
          
          // Migrate moves for this game
          if (Array.isArray(g.moves)) {
            for (const m of g.moves) {
              insertMove.run({
                game_id: id,
                ply: m.ply || 0,
                uci: m.uci || '',
                san: m.san || '',
                fen_after: m.fenAfter || null,
                ts: m.ts || new Date().toISOString()
              });
            }
          }
        }
      }
      
      // Migrate counters
      if (json.counters && typeof json.counters === 'object') {
        for (const [dateKey, count] of Object.entries(json.counters)) {
          insertCounter.run({ date_key: dateKey, count: count });
        }
      }
    });
    
    migrateAll();
    
    // Rename old JSON file to backup
    fs.renameSync(legacyJsonPath, legacyJsonPath + '.bak');
    console.log('[db] Migration complete. JSON backed up to games.json.bak');
    
  } catch (e) {
    console.error('[db] Migration error:', e.message);
  }
}

function flush() {
  // No-op for SQLite (writes are immediate)
  // Kept for API compatibility
}

function dateKeyFor(d) {
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}.${mm}.${dd}`;
}

function generateGameId(now = new Date()) {
  if (!db) init();
  const key = dateKeyFor(now);
  
  // Get or create counter
  let row = db.prepare('SELECT count FROM counters WHERE date_key = ?').get(key);
  let idx = row ? row.count + 1 : 1;
  
  // Ensure uniqueness
  let id = `${key}(${String(idx).padStart(2, '0')})`;
  while (db.prepare('SELECT 1 FROM games WHERE id = ?').get(id)) {
    idx += 1;
    id = `${key}(${String(idx).padStart(2, '0')})`;
  }
  
  // Update counter
  db.prepare('INSERT OR REPLACE INTO counters (date_key, count) VALUES (?, ?)').run(key, idx);
  
  return id;
}

function createGameRecord({ id, startFEN = 'startpos', variant = 'standard' }) {
  if (!db) init();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO games (id, created_at, updated_at, status, variant, start_fen, fen, pgn, white_ms, black_ms)
    VALUES (?, ?, ?, 'active', ?, ?, ?, '', 0, 0)
  `).run(id, now, now, variant, startFEN, startFEN === 'startpos' ? 'startpos' : startFEN);
  
  return getGame(id);
}

function getGame(id) {
  if (!db) init();
  const row = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  if (!row) return null;
  
  // Get moves for this game
  const moves = db.prepare('SELECT ply, uci, san, fen_after, ts FROM moves WHERE game_id = ? ORDER BY ply').all(id);
  
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    variant: row.variant,
    startFEN: row.start_fen,
    fen: row.fen,
    pgn: row.pgn,
    clocks: { whiteMs: row.white_ms, blackMs: row.black_ms },
    players: { hostName: row.host_name, opponentName: row.opponent_name },
    result: row.result,
    finishedAt: row.finished_at,
    moves: moves.map(m => ({
      ply: m.ply,
      uci: m.uci,
      san: m.san,
      fenAfter: m.fen_after,
      ts: m.ts
    }))
  };
}

function listUnfinished() {
  if (!db) init();
  const rows = db.prepare("SELECT id FROM games WHERE status != 'finished'").all();
  return rows.map(r => getGame(r.id));
}

function listGames(options = {}) {
  if (!db) init();
  const status = options.status || 'all';
  
  let query = 'SELECT id FROM games';
  if (status === 'finished') {
    query += " WHERE status = 'finished'";
  } else if (status === 'active') {
    query += " WHERE status != 'finished'";
  }
  query += ' ORDER BY updated_at DESC';
  
  const rows = db.prepare(query).all();
  return rows.map(r => getGame(r.id));
}

function appendMove(id, { ply, uci, san, fenAfter, ts }) {
  if (!db) init();
  
  // Insert move
  db.prepare(`
    INSERT INTO moves (game_id, ply, uci, san, fen_after, ts)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, ply, uci, san, fenAfter, ts);
  
  // Update game state
  db.prepare(`
    UPDATE games SET fen = ?, updated_at = ? WHERE id = ?
  `).run(fenAfter, ts, id);
}

function updateSnapshot(id, { fen, pgn, clocks, moves }) {
  if (!db) init();
  
  const updates = [];
  const params = [];
  
  if (typeof fen === 'string') {
    updates.push('fen = ?');
    params.push(fen);
  }
  if (typeof pgn === 'string') {
    updates.push('pgn = ?');
    params.push(pgn);
  }
  if (clocks && typeof clocks === 'object') {
    if (Number.isFinite(clocks.whiteMs)) {
      updates.push('white_ms = ?');
      params.push(clocks.whiteMs);
    }
    if (Number.isFinite(clocks.blackMs)) {
      updates.push('black_ms = ?');
      params.push(clocks.blackMs);
    }
  }
  
  updates.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  
  if (updates.length > 1) {
    db.prepare(`UPDATE games SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }
  
  // Handle moves update if provided
  if (Array.isArray(moves)) {
    const deleteMoves = db.prepare('DELETE FROM moves WHERE game_id = ?');
    const insertMove = db.prepare(`
      INSERT INTO moves (game_id, ply, uci, san, fen_after, ts)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const updateMoves = db.transaction(() => {
      deleteMoves.run(id);
      for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        insertMove.run(
          id,
          typeof m.ply === 'number' ? m.ply : i + 1,
          m.uci || '',
          m.san || '',
          m.fenAfter || null,
          m.ts || new Date().toISOString()
        );
      }
    });
    updateMoves();
  }
}

function finishGame(id, result) {
  if (!db) init();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE games SET status = 'finished', result = ?, finished_at = ?, updated_at = ?
    WHERE id = ?
  `).run(result, now, now, id);
}

function deleteGame(id) {
  if (!db) init();
  db.prepare('DELETE FROM moves WHERE game_id = ?').run(id);
  db.prepare('DELETE FROM games WHERE id = ?').run(id);
}

function setPlayerName(id, seat, name) {
  if (!db) init();
  const col = seat === 'host' ? 'host_name' : 'opponent_name';
  db.prepare(`UPDATE games SET ${col} = ?, updated_at = ? WHERE id = ?`).run(
    name,
    new Date().toISOString(),
    id
  );
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
