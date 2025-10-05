import os from 'node:os';
import EventEmitter from 'node:events';
import { EngineWorker, EngineConfig, AnalysisOptions, AnalysisResult } from './engineWorker.js';

interface WorkerWrapper {
  id: number;
  worker: EngineWorker;
  allocated: boolean;
}

interface QueueEntry<T> {
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

export interface PoolConfig {
  enginePath: string;
  threads: number;
  hash: number;
  defaultMultiPv: number;
  evalFile?: string;
  poolSize?: number;
}

export class EnginePool extends EventEmitter {
  private readonly workers: WorkerWrapper[] = [];
  private readonly queue: QueueEntry<WorkerWrapper>[] = [];
  private readonly locks = new Map<number, Promise<unknown>>();
  private readonly config: PoolConfig;

  constructor(config: PoolConfig) {
    super();
    this.config = config;
  }

  async init(): Promise<void> {
    const cpuCount = os.cpus()?.length ?? 1;
    const size = Math.min(this.config.poolSize ?? Math.max(1, Math.floor(cpuCount / 2)), 8);
    for (let i = 0; i < size; i++) {
      const workerConfig: EngineConfig = {
        path: this.config.enginePath,
        threads: this.config.threads,
        hash: this.config.hash,
        defaultMultiPv: this.config.defaultMultiPv,
        evalFile: this.config.evalFile,
      };
      const worker = new EngineWorker(workerConfig);
      await worker.init();
      this.workers.push({ id: i, worker, allocated: false });
    }
  }

  private getIdleWorker(): WorkerWrapper | undefined {
    return this.workers.find((w) => !w.allocated);
  }

  async acquire(): Promise<WorkerWrapper> {
    const idle = this.getIdleWorker();
    if (idle) {
      idle.allocated = true;
      return idle;
    }
    return new Promise<WorkerWrapper>((resolve, reject) => {
      this.queue.push({ resolve, reject });
    });
  }

  release(id: number) {
    const wrapper = this.workers.find((w) => w.id === id);
    if (!wrapper) return;
    wrapper.allocated = false;
    const next = this.queue.shift();
    if (next) {
      wrapper.allocated = true;
      next.resolve(wrapper);
    }
  }

  async runExclusive<T>(id: number, fn: (worker: EngineWorker) => Promise<T>): Promise<T> {
    const wrapper = this.workers.find((w) => w.id === id);
    if (!wrapper) throw new Error(`Worker ${id} not found`);
    const previous = this.locks.get(id) ?? Promise.resolve();
    let resolveLock: (value: unknown) => void;
    let rejectLock: (reason?: unknown) => void;
    const nextLock = new Promise((resolve, reject) => {
      resolveLock = resolve;
      rejectLock = reject;
    });
    this.locks.set(id, previous.then(() => nextLock));
    try {
      await previous;
      await wrapper.worker.init();
      const result = await fn(wrapper.worker);
      resolveLock!(undefined);
      return result;
    } catch (error) {
      rejectLock!(error);
      throw error;
    } finally {
      if (this.locks.get(id) === nextLock) {
        this.locks.delete(id);
      }
    }
  }

  async analyzeWithWorker(id: number, options: AnalysisOptions): Promise<AnalysisResult> {
    return this.runExclusive(id, (worker) => worker.analyze(options));
  }

  async newGame(id: number): Promise<void> {
    await this.runExclusive(id, (worker) => worker.newGame());
  }

  async configure(id: number, opts: { Threads?: number; Hash?: number; MultiPV?: number; EvalFile?: string }): Promise<void> {
    await this.runExclusive(id, (worker) => worker.configure(opts));
  }

  async stopAll(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.worker.stop()));
  }

  async dispose(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.worker.dispose()));
  }

  async checkHealth(): Promise<void> {
    const wrapper = this.workers[0];
    if (!wrapper) throw new Error('No workers in pool');
    await this.runExclusive(wrapper.id, (worker) => worker.ping());
  }
}

export type WorkerHandle = WorkerWrapper;
