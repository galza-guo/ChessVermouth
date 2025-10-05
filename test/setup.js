import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import dotenv from 'dotenv';
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const enginePath = process.env.ENGINE_PATH ?? path.join(rootDir, 'engine/stockfish/stockfish');
if (!fs.existsSync(path.resolve(rootDir, enginePath))) {
    execSync('node scripts/fetch-stockfish.mjs', { stdio: 'inherit', cwd: rootDir });
}
