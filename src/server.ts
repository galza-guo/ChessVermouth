import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import dotenv from 'dotenv';
import pino from 'pino';
import { WebSocketServer, WebSocket } from 'ws';
import { EnginePool } from './enginePool.js';
import { GameManager } from './gameManager.js';
import { registerRoutes } from './api/routes.js';

dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

interface AppConfig {
  enginePath: string;
  threads: number;
  hash: number;
  defaultMultiPv: number;
  defaultMovetime: number;
  poolSize?: number;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadConfig(): AppConfig {
  const enginePath = process.env.ENGINE_PATH ?? './engine/stockfish/stockfish';
  const threads = Number.parseInt(process.env.ENGINE_THREADS ?? '2', 10);
  const hash = Number.parseInt(process.env.ENGINE_HASH_MB ?? '256', 10);
  const defaultMultiPv = Number.parseInt(process.env.ENGINE_MULTIPV_DEFAULT ?? '2', 10);
  const defaultMovetime = 300;
  return {
    enginePath,
    threads: Number.isFinite(threads) ? threads : 2,
    hash: Number.isFinite(hash) ? hash : 256,
    defaultMultiPv: Number.isFinite(defaultMultiPv) ? defaultMultiPv : 2,
    defaultMovetime,
  };
}

export async function createServer() {
  const config = loadConfig();
  const pool = new EnginePool({
    enginePath: config.enginePath,
    threads: config.threads,
    hash: config.hash,
    defaultMultiPv: config.defaultMultiPv,
  });
  await pool.init();
  const gameManager = new GameManager(pool);

  const app = express();
  app.use(express.json());
  app.use(restrictToLan);
  // Allow CORS for LAN origins so the browser can call REST endpoints
  app.use(lanCors);
  const publicDir = path.resolve(__dirname, '../public');
  app.use(express.static(publicDir));

  registerRoutes(app, {
    pool,
    gameManager,
    defaultMovetime: config.defaultMovetime,
    defaultMultiPv: config.defaultMultiPv,
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (!req.url) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/ws/analyze') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }
    const remote = normalizeIp(req.socket.remoteAddress ?? '127.0.0.1');
    if (!isPrivateIp(remote)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (socket: WebSocket, req: http.IncomingMessage) => {
    const reqUrl = new URL(req.url ?? '/ws/analyze', 'http://localhost');
    const gameId = reqUrl.searchParams.get('gameId');
    const multipvParam = reqUrl.searchParams.get('multipv');
    const movetimeParam = reqUrl.searchParams.get('movetime');
    const fenParam = reqUrl.searchParams.get('fen') || undefined;
    const movesParam = reqUrl.searchParams.get('moves') || undefined; // space-separated UCI moves
    const multipv = multipvParam ? Number.parseInt(multipvParam, 10) : config.defaultMultiPv;
    const movetime = movetimeParam ? Number.parseInt(movetimeParam, 10) : config.defaultMovetime;

    const abortController = new AbortController();
    socket.on('close', () => abortController.abort());

    const sendInfo = (info: { multipv: number; depth?: number; pv: string[]; score?: unknown; nps?: number; nodes?: number }) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: 'info',
            multipv: info.multipv,
            depth: info.depth,
            pv: info.pv.join(' '),
            score: info.score ?? null,
            nps: info.nps,
            nodes: info.nodes,
          }),
        );
      }
    };

    const sendResultAndClose = (result: { bestmove: string; lines: { pv: string[]; score?: unknown; depth?: number }[] }) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: 'result',
            bestmove: result.bestmove,
            lines: result.lines.map((line) => ({
              pv: line.pv.join(' '),
              score: line.score ?? null,
              depth: line.depth,
            })),
          }),
        );
        socket.close(1000, 'analysis complete');
      }
    };

    // If a gameId is provided, use the existing game state managed on the server.
    if (gameId) {
      let state;
      try {
        state = gameManager.getGame(gameId);
      } catch (error) {
        socket.send(JSON.stringify({ type: 'error', message: (error as Error).message }));
        socket.close(1008, 'Game not found');
        return;
      }
      pool
        .analyzeWithWorker(state.workerId, {
          fen: state.initialFen,
          moves: [...state.moves],
          movetime,
          multipv,
          onInfo: sendInfo,
          signal: abortController.signal,
        })
        .then(sendResultAndClose)
        .catch((error) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'error', message: (error as Error).message }));
            socket.close(1011, 'analysis error');
          }
        });
      return;
    }

    // Stateless mode: accept fen and/or moves directly via query to avoid REST roundtrips/CORS.
    const directMoves = movesParam ? movesParam.split(' ').filter(Boolean) : [];

    (async () => {
      const handle = await pool.acquire();
      try {
        await pool.newGame(handle.id);
        const result = await pool.analyzeWithWorker(handle.id, {
          fen: fenParam,
          moves: directMoves.length > 0 ? directMoves : undefined,
          movetime,
          multipv,
          onInfo: sendInfo,
          signal: abortController.signal,
        });
        sendResultAndClose(result);
      } catch (error) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'error', message: (error as Error).message }));
          socket.close(1011, 'analysis error');
        }
      } finally {
        pool.release(handle.id);
      }
    })();
  });

  const port = Number.parseInt(process.env.PORT ?? '8080', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  const start = async () => {
    await new Promise<void>((resolve) => {
      server.listen(port, host, () => {
        logger.info({ port, host }, 'Server listening');
        resolve();
      });
    });
  };

  const stop = async () => {
    await pool.stopAll();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    await pool.dispose();
  };

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    try {
      await stop();
    } finally {
      process.exit(0);
    }
  });

  return { app, server, pool, gameManager, start, stop };
}

function restrictToLan(req: express.Request, res: express.Response, next: express.NextFunction) {
  const remote = normalizeIp(req.socket.remoteAddress ?? '127.0.0.1');
  if (!isPrivateIp(remote)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

function lanCors(req: express.Request, res: express.Response, next: express.NextFunction) {
  const origin = req.headers.origin ?? '';
  // Reflect LAN origins or localhost; browsers still enforce that the JS came from the same LAN
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
}

function normalizeIp(ip: string): string {
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  if (ip === '::1') return '127.0.0.1';
  return ip;
}

function isPrivateIp(ip: string): boolean {
  if (!ip) return false;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const second = Number.parseInt(ip.split('.')[1] ?? '0', 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip === '127.0.0.1') return true;
  if (ip.startsWith('169.254.')) return true;
  if (ip.startsWith('fe80') || ip.startsWith('FE80')) return true;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('FC') || ip.startsWith('FD')) return true;
  if (ip === '::1') return true;
  return false;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().then(({ start }) => start()).catch((error) => {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  });
}
