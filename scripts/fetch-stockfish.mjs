#!/usr/bin/env node
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const VERSION_TAG = 'sf_17.1';
const BASE_URL = `https://github.com/official-stockfish/Stockfish/releases/download/${VERSION_TAG}/`;

const PLATFORM_MAP = {
  'linux-x64': {
    asset: 'stockfish-ubuntu-x86-64-avx2.tar',
    binary: 'stockfish-ubuntu-x86-64-avx2/stockfish',
  },
  'linux-arm64': {
    asset: 'stockfish-ubuntu-arm64.tar',
    binary: 'stockfish-ubuntu-arm64/stockfish',
  },
  'darwin-x64': {
    asset: 'stockfish-macos-x86-64.zip',
    binary: 'stockfish-apple-silicon/MacOS/stockfish',
  },
  'darwin-arm64': {
    asset: 'stockfish-macos-m1.zip',
    binary: 'stockfish-apple-silicon/MacOS/stockfish',
  },
  'win32-x64': {
    asset: 'stockfish-windows-x86-64-avx2.zip',
    binary: 'stockfish-windows-x86-64-avx2.exe',
  },
};

function detectPlatform() {
  const override = process.env.STOCKFISH_PLATFORM ?? process.argv[2];
  if (override && PLATFORM_MAP[override]) return override;
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'linux' && arch === 'x64') return 'linux-x64';
  if (platform === 'linux' && arch === 'arm64') return 'linux-arm64';
  if (platform === 'darwin' && arch === 'x64') return 'darwin-x64';
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64';
  if (platform === 'win32' && arch === 'x64') return 'win32-x64';
  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

async function downloadAsset(url, destination) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  await pipeline(response.body, fs.createWriteStream(destination));
}

async function extractArchive(archivePath, destination) {
  await fsPromises.rm(destination, { recursive: true, force: true });
  await fsPromises.mkdir(destination, { recursive: true });
  if (archivePath.endsWith('.zip')) {
    await new Promise((resolve, reject) => {
      const unzip = spawn('unzip', ['-o', archivePath, '-d', destination], { stdio: 'inherit' });
      unzip.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error('Failed to unzip archive'));
      });
    });
  } else if (archivePath.endsWith('.tar')) {
    await new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-xf', archivePath, '-C', destination], { stdio: 'inherit' });
      tar.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error('Failed to extract tar archive'));
      });
    });
  } else {
    throw new Error(`Unsupported archive format: ${archivePath}`);
  }
}

async function moveBinaryAndNetwork(extractedDir, binaryRelativePath, finalDir) {
  const binarySource = await findFile(extractedDir, binaryRelativePath);
  await fsPromises.mkdir(finalDir, { recursive: true });
  const finalBinaryPath = path.join(finalDir, process.platform === 'win32' ? 'stockfish.exe' : 'stockfish');
  await fsPromises.copyFile(binarySource, finalBinaryPath);
  await fsPromises.chmod(finalBinaryPath, 0o755);
  const networks = await findFilesByExtension(path.dirname(binarySource), '.nnue');
  for (const network of networks) {
    const target = path.join(finalDir, path.basename(network));
    await fsPromises.copyFile(network, target);
  }
  return finalBinaryPath;
}

async function findFile(root, relativePath) {
  const candidate = path.join(root, relativePath);
  if (fs.existsSync(candidate)) return candidate;
  const entries = await fsPromises.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nested = await findFile(path.join(root, entry.name), relativePath);
    if (nested) return nested;
  }
  throw new Error(`Could not locate ${relativePath} inside ${root}`);
}

async function findFilesByExtension(root, extension) {
  const matches = [];
  const entries = await fsPromises.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFilesByExtension(fullPath, extension);
      matches.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      matches.push(fullPath);
    }
  }
  return matches;
}

async function verifyEngine(binaryPath) {
  const child = spawn(binaryPath, [], { stdio: 'pipe' });
  child.stdin.setDefaultEncoding('utf8');
  const rl = createInterface({ input: child.stdout });
  child.stdin.write('uci\n');
  const success = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      rl.close();
      child.kill('SIGKILL');
      resolve(false);
    }, 5000);
    rl.on('line', (line) => {
      if (line.trim() === 'uciok') {
        clearTimeout(timeout);
        rl.close();
        child.stdin.write('quit\n');
        resolve(true);
      }
    });
  });
  if (!success) {
    throw new Error('Engine verification failed');
  }
}

async function main() {
  const platformKey = detectPlatform();
  const platformInfo = PLATFORM_MAP[platformKey];
  const archiveName = platformInfo.asset;
  const downloadUrl = `${BASE_URL}${archiveName}`;
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'stockfish-'));
  const archivePath = path.join(tmpDir, archiveName);
  console.log(`Downloading ${downloadUrl}`);
  await downloadAsset(downloadUrl, archivePath);
  const extractDir = path.join(tmpDir, 'extracted');
  await extractArchive(archivePath, extractDir);
  const engineDir = path.resolve('engine/stockfish');
  const finalPath = await moveBinaryAndNetwork(extractDir, platformInfo.binary, engineDir);
  await verifyEngine(finalPath);
  console.log(`Stockfish installed at ${finalPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
