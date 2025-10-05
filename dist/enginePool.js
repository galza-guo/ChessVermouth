import os from 'node:os';
import EventEmitter from 'node:events';
import { EngineWorker } from './engineWorker.js';
export class EnginePool extends EventEmitter {
    constructor(config) {
        super();
        this.workers = [];
        this.queue = [];
        this.locks = new Map();
        this.config = config;
    }
    async init() {
        const cpuCount = os.cpus()?.length ?? 1;
        const size = Math.min(this.config.poolSize ?? Math.max(1, Math.floor(cpuCount / 2)), 8);
        for (let i = 0; i < size; i++) {
            const workerConfig = {
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
    getIdleWorker() {
        return this.workers.find((w) => !w.allocated);
    }
    async acquire() {
        const idle = this.getIdleWorker();
        if (idle) {
            idle.allocated = true;
            return idle;
        }
        return new Promise((resolve, reject) => {
            this.queue.push({ resolve, reject });
        });
    }
    release(id) {
        const wrapper = this.workers.find((w) => w.id === id);
        if (!wrapper)
            return;
        wrapper.allocated = false;
        const next = this.queue.shift();
        if (next) {
            wrapper.allocated = true;
            next.resolve(wrapper);
        }
    }
    async runExclusive(id, fn) {
        const wrapper = this.workers.find((w) => w.id === id);
        if (!wrapper)
            throw new Error(`Worker ${id} not found`);
        const previous = this.locks.get(id) ?? Promise.resolve();
        let resolveLock;
        let rejectLock;
        const nextLock = new Promise((resolve, reject) => {
            resolveLock = resolve;
            rejectLock = reject;
        });
        this.locks.set(id, previous.then(() => nextLock));
        try {
            await previous;
            await wrapper.worker.init();
            const result = await fn(wrapper.worker);
            resolveLock(undefined);
            return result;
        }
        catch (error) {
            rejectLock(error);
            throw error;
        }
        finally {
            if (this.locks.get(id) === nextLock) {
                this.locks.delete(id);
            }
        }
    }
    async analyzeWithWorker(id, options) {
        return this.runExclusive(id, (worker) => worker.analyze(options));
    }
    async newGame(id) {
        await this.runExclusive(id, (worker) => worker.newGame());
    }
    async configure(id, opts) {
        await this.runExclusive(id, (worker) => worker.configure(opts));
    }
    async stopAll() {
        await Promise.all(this.workers.map((w) => w.worker.stop()));
    }
    async dispose() {
        await Promise.all(this.workers.map((w) => w.worker.dispose()));
    }
    async checkHealth() {
        const wrapper = this.workers[0];
        if (!wrapper)
            throw new Error('No workers in pool');
        await this.runExclusive(wrapper.id, (worker) => worker.ping());
    }
}
