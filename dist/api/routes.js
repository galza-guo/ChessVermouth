import { Chess } from 'chess.js';
import { startGameSchema, moveSchema, endGameSchema, analyzeSchema, gameAnalysisSchema, } from './schema.js';
import { invertScore, scoreToNumber } from '../uci.js';
export function registerRoutes(app, deps) {
    const { pool, gameManager, defaultMovetime, defaultMultiPv } = deps;
    app.get('/health', async (_req, res) => {
        try {
            await pool.checkHealth();
            res.json({ status: 'ok' });
        }
        catch (error) {
            res.status(503).json({ status: 'error', message: error.message });
        }
    });
    app.post('/game/start', async (req, res) => {
        try {
            const payload = startGameSchema.parse(req.body);
            const state = await gameManager.startGame(payload.gameId, payload.initialFen);
            res.json({ gameId: state.gameId, workerId: state.workerId });
        }
        catch (error) {
            handleError(res, error);
        }
    });
    app.post('/game/move', (req, res) => {
        try {
            const payload = moveSchema.parse(req.body);
            gameManager.addMove(payload.gameId, payload.uci);
            res.json({ status: 'ok' });
        }
        catch (error) {
            handleError(res, error);
        }
    });
    app.post('/game/end', (req, res) => {
        try {
            const payload = endGameSchema.parse(req.body);
            gameManager.endGame(payload.gameId);
            res.json({ status: 'ok' });
        }
        catch (error) {
            handleError(res, error);
        }
    });
    app.post('/analyze', async (req, res) => {
        try {
            const payload = analyzeSchema.parse(req.body);
            const state = gameManager.getGame(payload.gameId);
            const { fen, moves } = { fen: state.initialFen, moves: [...state.moves] };
            const result = await pool.analyzeWithWorker(state.workerId, {
                fen,
                moves,
                movetime: payload.movetime ?? defaultMovetime,
                multipv: payload.multipv ?? defaultMultiPv,
            });
            res.json(formatAnalysisResponse(result));
        }
        catch (error) {
            handleError(res, error);
        }
    });
    app.post('/analysis/game', async (req, res) => {
        try {
            const payload = gameAnalysisSchema.parse(req.body);
            const chess = new Chess();
            try {
                // loadPgn typings vary across chess.js versions; rely on exceptions rather than boolean return
                chess.loadPgn(payload.pgn);
            }
            catch (_) {
                throw new Error('Invalid PGN');
            }
            const headers = chess.header();
            const initialFen = headers.SetUp === '1' && headers.FEN ? headers.FEN : undefined;
            const moves = chess.history({ verbose: true });
            const worker = await pool.acquire();
            try {
                await pool.newGame(worker.id);
                const board = initialFen ? new Chess(initialFen) : new Chess();
                const report = [];
                for (let i = 0; i < moves.length; i++) {
                    const move = moves[i];
                    const ply = i + 1;
                    const positionFen = board.fen();
                    const analysis = await pool.analyzeWithWorker(worker.id, {
                        fen: positionFen,
                        movetime: payload.movetimePerMove,
                        multipv: payload.multipv,
                    });
                    const bestLine = analysis.lines[0];
                    const scoreBefore = bestLine?.score;
                    const playedUci = move.from + move.to + (move.promotion ?? '');
                    const alternatives = analysis.lines
                        .filter((line) => line.pv[0] !== playedUci)
                        .map((line) => ({
                        pv: line.pv.join(' '),
                        score: line.score ?? null,
                        depth: line.depth,
                    }));
                    board.move(move);
                    let scoreAfter = analysis.lines.find((line) => line.pv[0] === playedUci)?.score;
                    if (!scoreAfter) {
                        const after = await pool.analyzeWithWorker(worker.id, {
                            fen: board.fen(),
                            movetime: payload.movetimePerMove,
                            multipv: 1,
                        });
                        const scoreAfterRaw = after.lines[0]?.score;
                        scoreAfter = invertScore(scoreAfterRaw ?? undefined);
                    }
                    const classification = classify(scoreBefore, scoreAfter);
                    report.push({
                        ply,
                        played: playedUci,
                        best: bestLine?.pv[0] ?? playedUci,
                        scoreBefore: scoreBefore ?? null,
                        scoreAfter: scoreAfter ?? null,
                        classification,
                        alts: alternatives,
                    });
                }
                res.json(report);
            }
            finally {
                pool.release(worker.id);
            }
        }
        catch (error) {
            handleError(res, error);
        }
    });
}
function formatAnalysisResponse(result) {
    return {
        bestmove: result.bestmove,
        lines: result.lines.map((line) => ({
            pv: line.pv.join(' '),
            score: line.score ?? null,
            depth: line.depth,
        })),
    };
}
function handleError(res, error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: message });
}
function classify(before, after) {
    if (!before || !after)
        return 'good';
    if (isMateDrop(before, after)) {
        return 'blunder';
    }
    const beforeScore = scoreToNumber(before);
    const afterScore = scoreToNumber(after);
    if (beforeScore === null || afterScore === null)
        return 'good';
    const drop = beforeScore - afterScore;
    if (drop >= 150)
        return 'blunder';
    if (drop >= 80)
        return 'mistake';
    if (drop >= 30)
        return 'inaccuracy';
    return 'good';
}
function isMateDrop(before, after) {
    if (before.type === 'mate' && before.value > 0) {
        if (after.type !== 'mate')
            return true;
        return after.value > before.value;
    }
    return false;
}
