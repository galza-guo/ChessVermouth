import { Chess } from 'chess.js';
import { EnginePool } from './enginePool.js';

export interface GameState {
  gameId: string;
  workerId: number;
  moves: string[];
  initialFen?: string;
}

export class GameManager {
  private readonly pool: EnginePool;
  private readonly games = new Map<string, GameState>();

  constructor(pool: EnginePool) {
    this.pool = pool;
  }

  async startGame(gameId: string, initialFen?: string): Promise<GameState> {
    if (this.games.has(gameId)) {
      throw new Error('Game already exists');
    }
    if (initialFen) {
      validateFen(initialFen);
    }
    const worker = await this.pool.acquire();
    try {
      await this.pool.newGame(worker.id);
    } catch (error) {
      this.pool.release(worker.id);
      throw error;
    }
    const state: GameState = {
      gameId,
      workerId: worker.id,
      moves: [],
      initialFen,
    };
    this.games.set(gameId, state);
    return state;
  }

  getGame(gameId: string): GameState {
    const state = this.games.get(gameId);
    if (!state) throw new Error('Game not found');
    return state;
  }

  addMove(gameId: string, uciMove: string) {
    const state = this.getGame(gameId);
    const chess = applyMovesToChess(state.initialFen, state.moves);
    const parsed = uciToMove(uciMove);
    const moved = chess.move(parsed);
    if (!moved) {
      throw new Error('Illegal move');
    }
    state.moves.push(uciMove);
  }

  endGame(gameId: string) {
    const state = this.getGame(gameId);
    this.games.delete(gameId);
    this.pool.release(state.workerId);
  }

  getMoves(gameId: string): string[] {
    return [...this.getGame(gameId).moves];
  }

  getWorkerId(gameId: string): number {
    return this.getGame(gameId).workerId;
  }

  getInitialFen(gameId: string): string | undefined {
    return this.getGame(gameId).initialFen;
  }
}

export function buildPositionFromGame(state: GameState): { fen?: string; moves: string[] } {
  return {
    fen: state.initialFen,
    moves: [...state.moves],
  };
}

export function validateFen(fen: string) {
  try {
    // chess.js throws on invalid FEN when constructing with an invalid string
    // eslint-disable-next-line no-new
    new Chess(fen);
  } catch (_) {
    throw new Error('Invalid FEN');
  }
}

export function reconstructPosition(initialFen: string | undefined, moves: string[]): { fen?: string; moves: string[] } {
  return {
    fen: initialFen,
    moves,
  };
}

export function applyMovesToChess(initialFen: string | undefined, moves: string[]): Chess {
  const chess = initialFen ? new Chess(initialFen) : new Chess();
  for (const move of moves) {
    const parsed = uciToMove(move);
    if (!chess.move(parsed)) {
      throw new Error(`Illegal move in history: ${move}`);
    }
  }
  return chess;
}

export function uciToMove(uci: string) {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci.slice(4) : undefined;
  return { from, to, promotion };
}
