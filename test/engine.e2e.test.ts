import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../src/server.js';

let ctx: Awaited<ReturnType<typeof createServer>>;

beforeAll(async () => {
  ctx = await createServer();
  await ctx.start();
});

afterAll(async () => {
  await ctx.stop();
});

describe('Engine integration', () => {
  it('analyzes a simple position', async () => {
    const worker = await ctx.pool.acquire();
    try {
      await ctx.pool.newGame(worker.id);
      const result = await ctx.pool.analyzeWithWorker(worker.id, {
        moves: ['e2e4', 'e7e5', 'g1f3'],
        movetime: 200,
        multipv: 2,
      });
      expect(result.bestmove).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
      expect(result.lines.length).toBeGreaterThan(0);
      expect(result.lines[0]?.pv.length).toBeGreaterThan(0);
      expect(result.lines[0]?.score).toBeTruthy();
    } finally {
      ctx.pool.release(worker.id);
    }
  });

  it('performs post-game analysis classification', async () => {
    const resStart = await request(ctx.app)
      .post('/game/start')
      .send({ gameId: 'test-game' })
      .expect(200);
    expect(resStart.body).toHaveProperty('gameId', 'test-game');

    await request(ctx.app).post('/game/move').send({ gameId: 'test-game', uci: 'e2e4' }).expect(200);
    await request(ctx.app).post('/game/move').send({ gameId: 'test-game', uci: 'e7e5' }).expect(200);
    await request(ctx.app).post('/game/move').send({ gameId: 'test-game', uci: 'g1f3' }).expect(200);

    const analyzeRes = await request(ctx.app)
      .post('/analyze')
      .send({ gameId: 'test-game', sideToMove: 'w', movetime: 200, multipv: 2 })
      .expect(200);
    expect(analyzeRes.body).toHaveProperty('bestmove');
    expect(analyzeRes.body.lines[0]).toHaveProperty('pv');

    await request(ctx.app).post('/game/end').send({ gameId: 'test-game', result: '1/2-1/2' }).expect(200);

    const pgn = `[
Event "Test"
]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O
`;
    const analysis = await request(ctx.app)
      .post('/analysis/game')
      .send({ pgn, movetimePerMove: 150, multipv: 2 })
      .expect(200);
    expect(Array.isArray(analysis.body)).toBe(true);
    expect(analysis.body.length).toBeGreaterThan(0);
    const sample = analysis.body[0];
    expect(sample).toHaveProperty('classification');
  });
});
