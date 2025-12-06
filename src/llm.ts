import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface LLMConfig {
  endpoint: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
}

export interface AnalysisContext {
  turn: 'white' | 'black';
  bestMove: string;
  wdl?: { win: number; draw: number; loss: number };
  score?: { type: 'cp' | 'mate'; value: number };
  lines: string[];
  moveHistory?: string[];
}

let cachedSystemPrompt: string | null = null;

function loadSystemPrompt(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  
  const promptPath = path.join(__dirname, '..', 'prompts', 'analysis-explanation.md');
  try {
    cachedSystemPrompt = fs.readFileSync(promptPath, 'utf-8');
    return cachedSystemPrompt;
  } catch (error) {
    console.warn('[LLM] Failed to load prompt template, using fallback');
    cachedSystemPrompt = '你是一位友好的国际象棋教练，用简洁的中文解释局面分析。';
    return cachedSystemPrompt;
  }
}

export function getConfig(): LLMConfig | null {
  const endpoint = process.env.ARK_API_ENDPOINT;
  const model = process.env.ARK_API_MODEL;
  const apiKey = process.env.ARK_API_KEY;

  if (!endpoint || !model || !apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    return null;
  }

  return {
    endpoint,
    model,
    apiKey,
    systemPrompt: loadSystemPrompt(),
  };
}

function formatScore(score?: { type: 'cp' | 'mate'; value: number }): string {
  if (!score) return '未知';
  if (score.type === 'mate') {
    return score.value > 0 ? `#${score.value} (白必胜)` : `#${Math.abs(score.value)} (黑必胜)`;
  }
  const pawns = score.value / 100;
  if (pawns > 0) return `+${pawns.toFixed(2)}`;
  return pawns.toFixed(2);
}

function formatWDL(wdl?: { win: number; draw: number; loss: number }): string {
  if (!wdl) return '未知';
  return `${(wdl.win / 10).toFixed(0)}%/${(wdl.draw / 10).toFixed(0)}%/${(wdl.loss / 10).toFixed(0)}%`;
}

function buildUserMessage(context: AnalysisContext): string {
  const parts: string[] = [
    `当前走子方: ${context.turn === 'white' ? '白方' : '黑方'}`,
    `推荐走法: ${context.bestMove}`,
    `胜/和/负: ${formatWDL(context.wdl)}`,
    `评分: ${formatScore(context.score)}`,
  ];

  if (context.lines.length > 0) {
    parts.push(`分析线路: ${context.lines.join(' | ')}`);
  }

  if (context.moveHistory && context.moveHistory.length > 0) {
    const recentMoves = context.moveHistory.slice(-10).join(' ');
    parts.push(`最近走法: ${recentMoves}`);
  }

  return parts.join('\n');
}

export async function explainAnalysis(
  config: LLMConfig,
  context: AnalysisContext,
  signal?: AbortSignal
): Promise<string> {
  const userMessage = buildUserMessage(context);

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 200,
      temperature: 0.7,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`LLM API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM API returned empty response');
  }

  return content.trim();
}
