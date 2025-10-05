import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { parseBestMoveLine, parseInfoLine, LineEvaluation, Score } from './uci.js';

const DEFAULT_READY_TIMEOUT_MS = 5000;
const DEFAULT_SEARCH_TIMEOUT_MS = 10000;

export interface EngineConfig {
  path: string;
  threads: number;
  hash: number;
  defaultMultiPv: number;
  evalFile?: string;
}

export interface AnalysisOptions {
  fen?: string;
  moves?: string[];
  movetime?: number;
  depth?: number;
  nodes?: number;
  multipv?: number;
  onInfo?: (payload: WorkerInfoEvent) => void;
  signal?: AbortSignal;
}

export interface WorkerInfoEvent {
  multipv: number;
  depth?: number;
  score?: Score;
  pv: string[];
  nps?: number;
  nodes?: number;
}

export interface AnalysisResult {
  bestmove: string;
  ponder?: string;
  lines: LineEvaluation[];
}

export class EngineWorker {
  private child?: ChildProcessWithoutNullStreams;
  private readonly path: string;
  private readonly config: EngineConfig;
  private readonly lineListeners: Array<(line: string) => void> = [];
  private readyPromise?: Promise<void>;
  private stopped = false;
  private currentMultiPv: number;

  constructor(config: EngineConfig) {
    this.config = config;
    this.path = config.path;
    this.currentMultiPv = config.defaultMultiPv;
  }

  async init(): Promise<void> {
    if (this.child) return;
    await this.spawnProcess();
    await this.waitForReady();
    await this.configure({
      Threads: this.config.threads,
      Hash: this.config.hash,
      MultiPV: this.config.defaultMultiPv,
      EvalFile: this.config.evalFile,
    });
  }

  private async spawnProcess(): Promise<void> {
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

  private write(command: string) {
    if (!this.child) throw new Error('Engine process not running');
    this.child.stdin.write(command + '\n');
  }

  private waitForLine(predicate: (line: string) => boolean, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for line matching predicate after ${timeoutMs}ms`));
      }, timeoutMs);

      const handler = (line: string) => {
        if (predicate(line)) {
          cleanup();
          resolve(line);
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        const idx = this.lineListeners.indexOf(handler);
        if (idx !== -1) this.lineListeners.splice(idx, 1);
      };

      this.lineListeners.push(handler);
    });
  }

  private async waitForReady(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = (async () => {
      this.write('uci');
      await this.waitForLine((l) => l === 'uciok', DEFAULT_READY_TIMEOUT_MS);
      this.write('isready');
      await this.waitForLine((l) => l === 'readyok', DEFAULT_READY_TIMEOUT_MS);
    })();
    return this.readyPromise;
  }

  async configure(options: { Threads?: number; Hash?: number; MultiPV?: number; EvalFile?: string }): Promise<void> {
    if (!this.child) await this.init();
    for (const [name, value] of Object.entries(options)) {
      if (value === undefined) continue;
      if (name === 'MultiPV') this.currentMultiPv = value;
      this.write(`setoption name ${name} value ${value}`);
    }
    this.write('isready');
    await this.waitForLine((l) => l === 'readyok', DEFAULT_READY_TIMEOUT_MS);
  }

  async newGame(): Promise<void> {
    this.write('ucinewgame');
    this.write('isready');
    await this.waitForLine((l) => l === 'readyok', DEFAULT_READY_TIMEOUT_MS);
  }

  async analyze(options: AnalysisOptions): Promise<AnalysisResult> {
    if (!this.child) await this.init();
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

    const goArgs: string[] = [];
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

    const lines = new Map<number, LineEvaluation>();

    const infoListener = (line: string) => {
      const parsed = parseInfoLine(line);
      if (!parsed) return;
      const multipvIndex = parsed.multipv ?? 1;
      const evaluation: LineEvaluation = {
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

    const bestMovePromise = new Promise<AnalysisResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Engine search timed out'));
      }, DEFAULT_SEARCH_TIMEOUT_MS);

      const listener = (line: string) => {
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
        if (idx !== -1) this.lineListeners.splice(idx, 1);
        const infoIdx = this.lineListeners.indexOf(infoListener);
        if (infoIdx !== -1) this.lineListeners.splice(infoIdx, 1);
        if (signal) signal.removeEventListener('abort', onAbort);
      };

      const onAbort = () => {
        cleanup();
        this.write('stop');
        reject(new Error('Analysis aborted'));
      };

      this.lineListeners.push(listener);
      this.lineListeners.push(infoListener);
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
    });

    this.write(`go ${goArgs.join(' ')}`);

    const result = await bestMovePromise.finally(async () => {
      if (multipv !== undefined && previousMultiPv !== multipv) {
        await this.configure({ MultiPV: previousMultiPv });
      }
    });

    return result;
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    this.write('stop');
  }

  async dispose(): Promise<void> {
    if (!this.child) return;
    this.child.kill('SIGTERM');
    await Promise.race([
      once(this.child, 'exit'),
      delay(1000),
    ]);
    this.child = undefined;
  }

  async ping(): Promise<void> {
    this.write('isready');
    await this.waitForLine((l) => l === 'readyok', DEFAULT_READY_TIMEOUT_MS);
  }
}

function buildPositionCommand(fen?: string, moves?: string[]): string {
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
