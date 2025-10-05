import { z } from 'zod';

const gameIdSchema = z.string().min(1).max(64);

export const startGameSchema = z.object({
  gameId: gameIdSchema,
  initialFen: z.string().min(1).max(120).optional(),
});

export const moveSchema = z.object({
  gameId: gameIdSchema,
  uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
});

export const endGameSchema = z.object({
  gameId: gameIdSchema,
  result: z.enum(['1-0', '0-1', '1/2-1/2']),
});

export const analyzeSchema = z.object({
  gameId: gameIdSchema,
  sideToMove: z.enum(['w', 'b']),
  movetime: z.number().int().positive().max(10000).default(300),
  multipv: z.number().int().min(1).max(5).default(2),
});

export const gameAnalysisSchema = z.object({
  pgn: z.string().min(1),
  movetimePerMove: z.number().int().positive().max(10000).default(200),
  multipv: z.number().int().min(1).max(5).default(2),
});

export type StartGameInput = z.infer<typeof startGameSchema>;
export type MoveInput = z.infer<typeof moveSchema>;
export type EndGameInput = z.infer<typeof endGameSchema>;
export type AnalyzeInput = z.infer<typeof analyzeSchema>;
export type GameAnalysisInput = z.infer<typeof gameAnalysisSchema>;
