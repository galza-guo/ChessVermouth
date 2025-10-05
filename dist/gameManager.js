import { Chess } from 'chess.js';
export class GameManager {
    constructor(pool) {
        this.games = new Map();
        this.pool = pool;
    }
    async startGame(gameId, initialFen) {
        if (this.games.has(gameId)) {
            throw new Error('Game already exists');
        }
        if (initialFen) {
            validateFen(initialFen);
        }
        const worker = await this.pool.acquire();
        try {
            await this.pool.newGame(worker.id);
        }
        catch (error) {
            this.pool.release(worker.id);
            throw error;
        }
        const state = {
            gameId,
            workerId: worker.id,
            moves: [],
            initialFen,
        };
        this.games.set(gameId, state);
        return state;
    }
    getGame(gameId) {
        const state = this.games.get(gameId);
        if (!state)
            throw new Error('Game not found');
        return state;
    }
    addMove(gameId, uciMove) {
        const state = this.getGame(gameId);
        const chess = applyMovesToChess(state.initialFen, state.moves);
        const parsed = uciToMove(uciMove);
        const moved = chess.move(parsed);
        if (!moved) {
            throw new Error('Illegal move');
        }
        state.moves.push(uciMove);
    }
    endGame(gameId) {
        const state = this.getGame(gameId);
        this.games.delete(gameId);
        this.pool.release(state.workerId);
    }
    getMoves(gameId) {
        return [...this.getGame(gameId).moves];
    }
    getWorkerId(gameId) {
        return this.getGame(gameId).workerId;
    }
    getInitialFen(gameId) {
        return this.getGame(gameId).initialFen;
    }
}
export function buildPositionFromGame(state) {
    return {
        fen: state.initialFen,
        moves: [...state.moves],
    };
}
export function validateFen(fen) {
    try {
        // chess.js throws on invalid FEN when constructing with an invalid string
        // eslint-disable-next-line no-new
        new Chess(fen);
    }
    catch (_) {
        throw new Error('Invalid FEN');
    }
}
export function reconstructPosition(initialFen, moves) {
    return {
        fen: initialFen,
        moves,
    };
}
export function applyMovesToChess(initialFen, moves) {
    const chess = initialFen ? new Chess(initialFen) : new Chess();
    for (const move of moves) {
        const parsed = uciToMove(move);
        if (!chess.move(parsed)) {
            throw new Error(`Illegal move in history: ${move}`);
        }
    }
    return chess;
}
export function uciToMove(uci) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci.slice(4) : undefined;
    return { from, to, promotion };
}
