import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { parseBestMoveLine, parseInfoLine } from './uci.js';
const DEFAULT_READY_TIMEOUT_MS = 5000;
const DEFAULT_SEARCH_TIMEOUT_MS = 10000;
export class EngineWorker {
    constructor(config) {
        this.lineListeners = [];
        this.stopped = false;
        this.config = config;
        this.path = config.path;
        this.currentMultiPv = config.defaultMultiPv;
    }
    async init() {
        if (this.child)
            return;
        await this.spawnProcess();
        await this.waitForReady();
        await this.configure({
            Threads: this.config.threads,
            Hash: this.config.hash,
            MultiPV: this.config.defaultMultiPv,
            EvalFile: this.config.evalFile,
        });
    }
    async spawnProcess() {
        this.child = spawn(this.path, [], { stdio: 'pipe' });
        this.child.on('exit', () => {
            this.child = undefined;
        });
        this.child.stderr.setEncoding('utf8');
        this.child.stdout.setEncoding('utf8');
        const rl = createInterface({ input: this.child.stdout });
        rl.on('line', (line) => {
            for (const listener of this.lineListeners) {
                listener(line.trim());
            }
        });
        this.child.stdin.setDefaultEncoding('utf8');
    }
    write(command) {
        if (!this.child)
            throw new Error('Engine process not running');
        this.child.stdin.write(command + '\n');
    }
    waitForLine(predicate, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error(`Timed out waiting for line matching predicate after ${timeoutMs}ms`));
            }, timeoutMs);
            const handler = (line) => {
                if (predicate(line)) {
                    cleanup();
                    resolve(line);
                }
            };
            const cleanup = () => {
                clearTimeout(timeout);
                const idx = this.lineListeners.indexOf(handler);
                if (idx !== -1)
                    this.lineListeners.splice(idx, 1);
            };
            this.lineListeners.push(handler);
        });
    }
    async waitForReady() {
        if (this.readyPromise)
            return this.readyPromise;
        this.readyPromise = (async () => {
            this.write('uci');
            await this.waitForLine((l) => l === 'uciok', DEFAULT_READY_TIMEOUT_MS);
            this.write('isready');
            await this.waitForLine((l) => l === 'readyok', DEFAULT_READY_TIMEOUT_MS);
        })();
        return this.readyPromise;
    }
    async configure(options) {
        if (!this.child)
            await this.init();
        for (const [name, value] of Object.entries(options)) {
            if (value === undefined)
                continue;
            if (name === 'MultiPV')
                this.currentMultiPv = typeof value === 'number' ? value : Number(value);
            this.write(`setoption name ${name} value ${value}`);
        }
        this.write('isready');
        await this.waitForLine((l) => l === 'readyok', DEFAULT_READY_TIMEOUT_MS);
    }
    async newGame() {
        this.write('ucinewgame');
        this.write('isready');
        await this.waitForLine((l) => l === 'readyok', DEFAULT_READY_TIMEOUT_MS);
    }
    async analyze(options) {
        if (!this.child)
            await this.init();
        const { fen, moves, movetime, depth, nodes, multipv, onInfo, signal } = options;
        if (signal?.aborted) {
            throw new Error('Analysis aborted');
        }
        const previousMultiPv = this.currentMultiPv;
        if (multipv !== undefined && multipv !== this.currentMultiPv) {
            await this.configure({ MultiPV: multipv });
        }
        const positionCmd = buildPositionCommand(fen, moves);
        this.write(positionCmd);
        const goArgs = [];
        if (movetime !== undefined) {
            goArgs.push(`movetime ${movetime}`);
        }
        if (depth !== undefined) {
            goArgs.push(`depth ${depth}`);
        }
        if (nodes !== undefined) {
            goArgs.push(`nodes ${nodes}`);
        }
        if (goArgs.length === 0) {
            goArgs.push('movetime 300');
        }
        const lines = new Map();
        const infoListener = (line) => {
            const parsed = parseInfoLine(line);
            if (!parsed)
                return;
            const multipvIndex = parsed.multipv ?? 1;
            const evaluation = {
                multipv: multipvIndex,
                depth: parsed.depth,
                pv: parsed.pv ?? [],
                score: parsed.score,
                nps: parsed.nps,
                nodes: parsed.nodes,
            };
            lines.set(multipvIndex, evaluation);
            if (onInfo) {
                onInfo({
                    multipv: multipvIndex,
                    depth: parsed.depth,
                    pv: parsed.pv ?? [],
                    score: parsed.score,
                    nps: parsed.nps,
                    nodes: parsed.nodes,
                });
            }
        };
        const bestMovePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('Engine search timed out'));
            }, DEFAULT_SEARCH_TIMEOUT_MS);
            const listener = (line) => {
                const best = parseBestMoveLine(line);
                if (best) {
                    cleanup();
                    const sorted = Array.from(lines.values()).sort((a, b) => a.multipv - b.multipv);
                    resolve({ bestmove: best.bestmove, ponder: best.ponder, lines: sorted });
                }
            };
            const cleanup = () => {
                clearTimeout(timeout);
                const idx = this.lineListeners.indexOf(listener);
                if (idx !== -1)
                    this.lineListeners.splice(idx, 1);
                const infoIdx = this.lineListeners.indexOf(infoListener);
                if (infoIdx !== -1)
                    this.lineListeners.splice(infoIdx, 1);
                if (signal)
                    signal.removeEventListener('abort', onAbort);
            };
            const onAbort = () => {
                cleanup();
                this.write('stop');
                reject(new Error('Analysis aborted'));
            };
            this.lineListeners.push(listener);
            this.lineListeners.push(infoListener);
            if (signal)
                signal.addEventListener('abort', onAbort, { once: true });
        });
        this.write(`go ${goArgs.join(' ')}`);
        const result = await bestMovePromise.finally(async () => {
            if (multipv !== undefined && previousMultiPv !== multipv) {
                await this.configure({ MultiPV: previousMultiPv });
            }
        });
        return result;
    }
    async stop() {
        if (!this.child)
            return;
        this.write('stop');
    }
    async dispose() {
        if (!this.child)
            return;
        this.child.kill('SIGTERM');
        await Promise.race([
            once(this.child, 'exit'),
            delay(1000),
        ]);
        this.child = undefined;
    }
    async ping() {
        this.write('isready');
        await this.waitForLine((l) => l === 'readyok', DEFAULT_READY_TIMEOUT_MS);
    }
}
function buildPositionCommand(fen, moves) {
    if (fen) {
        if (moves && moves.length > 0) {
            return `position fen ${fen} moves ${moves.join(' ')}`;
        }
        return `position fen ${fen}`;
    }
    if (moves && moves.length > 0) {
        return `position startpos moves ${moves.join(' ')}`;
    }
    return 'position startpos';
}
