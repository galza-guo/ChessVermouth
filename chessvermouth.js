#!/usr/bin/env node

/**
 * ChessVermouth One-Click Setup & Launcher
 * macOS-First Cross-Platform Solution
 * 
 * Usage:
 *   node chessvermouth.js
 *   ./chessvermouth.js (if made executable)
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);

const { spawn, execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Platform detection and configuration
const platform = os.platform();
const isMacOS = platform === 'darwin';
const isWindows = platform === 'win32';
const isLinux = platform === 'linux';

// Helper function to find npm command
// defaults to 'npm' if not found
async function findNpmCommand() {
  return new Promise((resolve) => {
    if (isWindows) {
      exec('where npm', (err, stdout) => {
        if (!err && stdout && stdout.trim()) {
          resolve('npm');
          return;
        }
        const commonPaths = [
          'C:\\Program Files\\nodejs\\npm.cmd',
          'C:\\Program Files (x86)\\nodejs\\npm.cmd',
          `${process.env.APPDATA}\\npm\\npm.cmd`,
          `${process.env.LOCALAPPDATA}\\npm\\npm.cmd`
        ];
        for (const npmPath of commonPaths) {
          try { if (fs.existsSync(npmPath)) { resolve(npmPath); return; } } catch (_) {}
        }
        exec('npm --version', (e2) => { resolve(!e2 ? 'npm' : 'npm'); });
      });
      return;
    }
    exec('which npm', (err) => {
      if (!err) { resolve('npm'); return; }
      exec('npm --version', (e2) => { resolve(!e2 ? 'npm' : 'npm'); });
    });
  });
}

const config = {
  darwin: {
    name: 'macOS',
    browserCommand: 'open',
    notification: 'osascript',
    packageManager: 'brew',
    nodeInstallCmd: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" && brew install node'
  },
  win32: {
    name: 'Windows',
    browserCommand: 'start',
    notification: 'powershell',
    packageManager: 'choco',
    nodeInstallCmd: 'powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString(\'https://community.chocolatey.org/install.ps1\'))" && choco install nodejs'
  },
  linux: {
    name: 'Linux',
    browserCommand: 'xdg-open',
    notification: 'notify-send',
    packageManager: 'apt',
    nodeInstallCmd: 'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs'
  }
}[platform] || {
  // Fallback to macOS-style defaults if an unknown platform is detected
  name: 'Unknown',
  browserCommand: isWindows ? 'start' : (isLinux ? 'xdg-open' : 'open'),
  notification: isWindows ? 'powershell' : (isLinux ? 'notify-send' : 'osascript'),
  packageManager: isLinux ? 'apt' : 'brew',
  nodeInstallCmd: isLinux
    ? 'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs'
    : '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" && brew install node'
};

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function notify(title, message) {
  if (isMacOS) {
    try {
      // Use argument form to avoid AppleScript parsing issues
      const { spawnSync } = require('child_process');
      spawnSync('osascript', ['-e', `display notification "${String(message).replace(/"/g, '\\"')}" with title "${String(title).replace(/"/g, '\\"')}" sound name "Glass"`], { stdio: 'ignore' });
    } catch (e) {
      // Fallback to console if notification fails
    }
  }
  log(`🔔 ${title}: ${message}`, 'cyan');
}

function clearScreen() {
  console.clear();
}

// Print the ASCII banner text (no logo)
function showAsciiBanner() {
  const text = String.raw`
====================================================================================
======  ====  ================================================  =====  =============
======  ====  ================================================  ====== =============
======  ====  ===========================================  ===  ====== =============
======  ====  ===   ===  =   ===  =  = ====   ===  =  ==    ==  ==========   =======
======   ==   ==  =  ==    =  ==        ==     ==  =  ===  ===    =======  =  ======
=======  ==  ===     ==  =======  =  =  ==  =  ==  =  ===  ===  =  =======  ========
=======  ==  ===  =====  =======  =  =  ==  =  ==  =  ===  ===  =  ========  =======
========    ====  =  ==  =======  =  =  ==  =  ==  =  ===  ===  =  ======  =  ======
=========  ======   ===  =======  =  =  ===   ====    ===   ==  =  =======   =======
====================================================================================
====================================================================================
======================      ====================  ==================================
=====================   ==   ===================  ==================================
=====================  ====  ===================  ==========  ======================
=====================  =========   ===  =  = ===  =====  ==    =====================
=====================  ========  =  ==        ==    ========  ======================
=====================  ===   =====  ==  =  =  ==  =  ==  ===  ======================
=====================  ====  ===    ==  =  =  ==  =  ==  ===  ======================
=====================   ==   ==  =  ==  =  =  ==  =  ==  ===  ======================
======================      ====    ==  =  =  ==    ===  ===   =====================
====================================================================================`;
  console.log(text);
  console.log('');
}

function showBanner() {
  clearScreen();
  showAsciiBanner();
  log('♟️  ChessVermouth Setup & Launcher', 'bright');
  log('=====================================', 'bright');
  log(`Optimized for ${config.name}`, 'blue');
  log('', 'reset');
}

// RFC1918 LAN IP detection and URL opener helpers
function getLanIpRFC1918() {
  try {
    const interfaces = require('os').networkInterfaces();
    let firstExternal = null;
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          const ip = iface.address;
          if (ip.startsWith('10.') || ip.startsWith('192.168.') || (ip.startsWith('172.') && (() => { const n = parseInt(ip.split('.')[1], 10); return n >= 16 && n <= 31; })())) {
            return ip;
          }
          if (!firstExternal) firstExternal = ip;
        }
      }
    }
    return firstExternal || 'localhost';
  } catch (_) {
    return 'localhost';
  }
}

function getLanIpsRFC1918() {
  const ips = [];
  try {
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          const ip = iface.address;
          if (
            ip.startsWith('10.') ||
            ip.startsWith('192.168.') ||
            (ip.startsWith('172.') && (() => { const n = parseInt(ip.split('.')[1], 10); return n >= 16 && n <= 31; })())
          ) {
            ips.push(ip);
          }
        }
      }
    }
  } catch (_) {}
  return ips.length ? ips : [];
}

function openUrl(url) {
  const q = (s) => '"' + String(s).replace(/"/g, '\\"') + '"';
  if (isWindows) {
    exec(`start "" ${q(url)}`, { shell: true });
  } else {
    exec(`${config.browserCommand} ${q(url)}`);
  }
}

// System checks
async function checkNodeJS() {
  return new Promise((resolve) => {
    exec('node --version', (error, stdout) => {
      if (error) {
        resolve(false);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function parseNodeMajor(vstr) {
  if (!vstr) return 0;
  const s = String(vstr).replace(/^v/, '');
  const major = parseInt(s.split('.')[0], 10);
  return Number.isFinite(major) ? major : 0;
}

async function checkNPM() {
  return new Promise((resolve) => {
    exec('npm --version', (error, stdout) => {
      if (error) {
        resolve(false);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

async function checkPort(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.listen(port, () => {
      server.close();
      resolve(true);
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

async function findAvailablePort(startPort, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await checkPort(port)) {
      return port;
    }
  }
  return null;
}

async function checkDependencies() {
  log('🔍 Checking system dependencies...', 'yellow');
  
  const nodeVersion = await checkNodeJS();
  const npmVersion = await checkNPM();
  
  const results = {
    node: nodeVersion,
    npm: npmVersion,
    serverPort: null,
    clientPort: null,
    serverPortAvailable: null,
    clientPortAvailable: null
  };
  
  if (nodeVersion) {
    log(`✅ Node.js: ${nodeVersion}`, 'green');
  } else {
    log('❌ Node.js: Not installed', 'red');
  }
  
  if (npmVersion) {
    log(`✅ npm: ${npmVersion}`, 'green');
  } else {
    log('❌ npm: Not installed', 'red');
  }
  
  log('', 'reset');
  return results;
}

// Installation functions
async function installNodeJS() {
  log('📦 Installing Node.js...', 'yellow');
  notify('ChessVermouth', 'Installing Node.js - this may take a few minutes');
  
  try {
    if (isMacOS) {
      // Check if Homebrew is installed
      try {
        execSync('which brew', { stdio: 'ignore' });
      } catch {
        log('Installing Homebrew first...', 'blue');
        execSync(config.nodeInstallCmd, { stdio: 'inherit' });
      }
      
      if (!await checkNodeJS()) {
        execSync('brew install node', { stdio: 'inherit' });
      }
    } else if (isWindows) {
      // Windows implementation would go here
      log('Windows Node.js installation - please install manually from nodejs.org', 'red');
      return false;
    } else if (isLinux) {
      // Linux implementation would go here
      log('Linux Node.js installation - please install using your package manager', 'red');
      return false;
    }
    
    log('✅ Node.js installed successfully!', 'green');
    notify('ChessVermouth', 'Node.js installation complete');
    return true;
  } catch (error) {
    log(`❌ Node.js installation failed: ${error.message}`, 'red');
    return false;
  }
}

async function installDependencies() {
  log('📦 Installing game dependencies...', 'yellow');
  notify('ChessVermouth', 'Installing game dependencies');
  
  try {
    // Install root (engine server) dependencies and build latest engine
    log('Installing engine server dependencies (root)...', 'blue');
    execSync('npm install', { stdio: 'inherit' });
    log('Building engine server...', 'blue');
    execSync('npm run build', { stdio: 'inherit' });
    // Fetch Stockfish engine binary
    try {
      log('Ensuring Stockfish engine binary is present...', 'blue');
      execSync('node scripts/fetch-stockfish.mjs', { stdio: 'inherit' });
    } catch (_) {
      log('⚠️  Could not fetch Stockfish binary now; it will be attempted again at runtime', 'yellow');
    }

    // Install socket server dependencies
    log('Installing server dependencies...', 'blue');
    execSync('cd server && npm install', { stdio: 'inherit' });
    
    // Install client dependencies
    log('Installing client dependencies...', 'blue');
    execSync('cd client && npm install', { stdio: 'inherit' });
    
    // Validate artifacts
    const distServer = path.join(__dirname, 'dist', 'server.js');
    const sfBin = path.join(__dirname, 'engine', 'stockfish', 'stockfish');
    let ok = true;
    if (!fs.existsSync(distServer)) { log('❌ Missing dist/server.js (engine server build failed)', 'red'); ok = false; }
    if (!fs.existsSync(sfBin)) { log('⚠️  Stockfish binary not found; hints/analysis may be unavailable until fetched', 'yellow'); }
    if (!fs.existsSync(path.join(__dirname, 'server', 'node_modules'))) { log('❌ Missing server/node_modules', 'red'); ok = false; }
    if (!fs.existsSync(path.join(__dirname, 'client', 'node_modules'))) { log('❌ Missing client/node_modules', 'red'); ok = false; }

    if (ok) {
      log('✅ Dependencies installed successfully!', 'green');
      notify('ChessVermouth', 'Dependencies installed successfully');
    } else {
      log('⚠️  Some components failed validation. Please review the messages above.', 'yellow');
    }
    return true;
  } catch (error) {
    log(`❌ Dependency installation failed: ${error.message}`, 'red');
    return false;
  }
}

// Process management
let serverProcess = null;
let clientProcess = null;
let engineProcess = null;

async function httpGetJson(url, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    try {
      const isHttps = url.startsWith('https:');
      const mod = require(isHttps ? 'https' : 'http');
      const req = mod.get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(data || '{}') });
          } catch (_) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('timeout'));
      });
      req.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function probeServerRange(base = 3001, attempts = 10, timeoutMs = 800) {
  for (let i = 0; i < attempts; i++) {
    const port = base + i;
    try {
      const res = await httpGetJson(`http://127.0.0.1:${port}/server-info`, timeoutMs);
      if (res.status === 200 && res.json && (res.json.lanIp || res.json.serverUrl)) {
        return { port, info: res.json };
      }
    } catch (_) {}
  }
  return null;
}

async function probeEngineRange(base = 8080, attempts = 10, timeoutMs = 800) {
  for (let i = 0; i < attempts; i++) {
    const port = base + i;
    try {
      const res = await httpGetJson(`http://127.0.0.1:${port}/health`, timeoutMs);
      if (res.status === 200) return { port };
    } catch (_) {}
  }
  return null;
}

async function probeClientRange(base = 9518, attempts = 10, timeoutMs = 800) {
  for (let i = 0; i < attempts; i++) {
    const port = base + i;
    try {
      const res = await httpGetJson(`http://127.0.0.1:${port}/`, timeoutMs);
      // If we get any HTTP response, assume dev server is up
      if (res && typeof res.status === 'number' && res.status > 0) {
        return { port };
      }
    } catch (_) {}
  }
  return null;
}

async function checkSystemStatus() {
  // Reset statuses
  engineStatus = 'not-started';
  serverStatus = 'not-started';
  clientStatus = 'not-started';

  // Node/npm
  const nodeVersion = await checkNodeJS();
  const npmVersion = await checkNPM();
  if (nodeVersion) log(`✅ Node.js: ${nodeVersion}`, 'green'); else log('❌ Node.js: Not installed', 'red');
  if (npmVersion) log(`✅ npm: ${npmVersion}`, 'green'); else log('❌ npm: Not installed', 'red');

  // Probe running services
  const [engine, server, client] = await Promise.all([
    probeEngineRange(),
    probeServerRange(),
    probeClientRange()
  ]);

  if (engine) {
    engineStatus = 'ready';
    portConfig.enginePort = engine.port;
    log(`✅ Engine detected on port ${engine.port}`, 'green');
  } else {
    log('ℹ️  Engine not detected on ports 8080-8089', 'yellow');
  }
  if (server) {
    serverStatus = 'ready';
    portConfig.serverPort = server.port;
    const ip = (server.info && server.info.lanIp) ? server.info.lanIp : getLanIpRFC1918();
    log(`✅ Server detected on port ${server.port} (LAN IP: ${ip})`, 'green');
  } else {
    log('ℹ️  Server not detected on ports 3001-3010', 'yellow');
  }
  if (client) {
    clientStatus = 'ready';
    portConfig.clientPort = client.port;
    log(`✅ Frontend detected on port ${client.port}`, 'green');
  } else {
    log('ℹ️  Frontend not detected on ports 9518-9527', 'yellow');
  }

  // Print summary
  log('', 'reset');
  clearScreen();
  showAsciiBanner();
  printStatusSummary();
}

// Dynamic port configuration
let portConfig = {
  serverPort: 3001,
  clientPort: 9518,
  enginePort: 8080
};

let engineStatus = 'not-started'; // 'not-started' | 'starting' | 'ready' | 'unavailable'
let serverStatus = 'not-started'; // 'not-started' | 'starting' | 'ready'
let clientStatus = 'not-started'; // 'not-started' | 'starting' | 'ready'

function printStatusSummary() {
  const lanIps = getLanIpsRFC1918();
  const primaryLan = lanIps[0] || 'localhost';
  log('----------------------------------------', 'bright');
  log('Status Summary', 'bright');
  const engLabel = engineStatus === 'ready' ? 'Ready' : (engineStatus === 'unavailable' ? 'Unavailable' : (engineStatus === 'not-started' ? 'Not started' : 'Starting'));
  const engColor = engineStatus === 'ready' ? 'green' : (engineStatus === 'unavailable' ? 'yellow' : (engineStatus === 'not-started' ? 'blue' : 'blue'));
  log(`- Engine: port ${portConfig.enginePort} | ${engLabel}`, engColor);

  const srvLabel = serverStatus === 'ready' ? 'Ready (bind 0.0.0.0)' : (serverStatus === 'starting' ? 'Starting' : 'Not started');
  const srvColor = serverStatus === 'ready' ? 'green' : (serverStatus === 'starting' ? 'blue' : 'blue');
  log(`- Server: port ${portConfig.serverPort} | ${srvLabel}`, srvColor);

  const cliLabel = clientStatus === 'ready' ? 'Ready' : (clientStatus === 'starting' ? 'Starting' : 'Not started');
  const cliColor = clientStatus === 'ready' ? 'green' : (clientStatus === 'starting' ? 'blue' : 'blue');
  log(`- Client: port ${portConfig.clientPort} | ${cliLabel}`, cliColor);

  log('- URLs:', 'cyan');
  if (clientStatus === 'ready') {
    log(`  Local:   http://localhost:${portConfig.clientPort}`, 'blue');
    if (lanIps.length) {
      for (const ip of lanIps) {
        log(`  Network: http://${ip}:${portConfig.clientPort}/?server=${ip}`, 'blue');
      }
    } else {
      log('  Network: (no LAN IP detected)', 'yellow');
    }
  } else {
    log('  UI not started (run Option 1 or 4 to serve the frontend)', 'yellow');
  }

  // Server API info
  if (serverStatus === 'ready') {
    if (primaryLan && primaryLan !== 'localhost') {
      log(`- Server API: http://${primaryLan}:${portConfig.serverPort}`, 'cyan');
    } else {
      log(`- Server API: http://localhost:${portConfig.serverPort}`, 'cyan');
    }
  }
  log('----------------------------------------', 'bright');
}

async function startServer() {
  return new Promise(async (resolve, reject) => {
    try {
      const npmCmd = await findNpmCommand();
      serverStatus = 'starting';
      // Ensure we pick an available server port right before starting
      const desiredServerPort = await findAvailablePort(portConfig.serverPort || 3001) || 3001;
      if (desiredServerPort !== portConfig.serverPort) {
        log(`ℹ️  Selected free server port ${desiredServerPort} (was ${portConfig.serverPort})`, 'blue');
        portConfig.serverPort = desiredServerPort;
      }
      log(`🚀 Starting chess server on port ${portConfig.serverPort} using Node...`, 'yellow');
      
      // Get local network info for display
      const lanIp = getLanIpRFC1918();
      
      if (lanIp !== 'localhost') {
        log(`🌐 Detected LAN IP: ${lanIp}`, 'blue');
        // Client port may change when Vite starts; final LAN URL is printed after client starts.
        log(`📱 LAN hint: client will be on http://${lanIp}:<clientPort> (exact port printed after client starts)`, 'cyan');
      }
      
      // Pass the dynamic port to the server via environment variable
      const spawnOptions = {
        cwd: path.join(__dirname, 'server'),
        stdio: 'pipe',
        env: { 
          ...process.env, 
          PORT: portConfig.serverPort.toString(),
          LAN_IP: lanIp,
          ENGINE_HOST: '127.0.0.1',
          ENGINE_PORT: String(portConfig.enginePort)
        }
      };
      
      // Use shell on Windows for better npm command handling
      if (isWindows) {
        spawnOptions.shell = true;
      }
      
      serverProcess = spawn('node', ['index.js'], spawnOptions);
      let retrying = false;

      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        // Only emit a concise success line once
        if (output.includes('Server is online')) {
          log(`✅ Server started successfully on port ${portConfig.serverPort}!`, 'green');
          notify('ChessVermouth', `Server is ready on port ${portConfig.serverPort}`);
          serverStatus = 'ready';
          resolve();
        }
      });
      
      serverProcess.stderr.on('data', (data) => {
        log(`Server error: ${data}`, 'red');
        const text = data.toString();
        if (text.includes('EADDRINUSE')) {
          log('⚠️  Server port in use; trying next available port...', 'yellow');
          try {
            // Try again on next available port
            findAvailablePort((portConfig.serverPort || 3001) + 1).then((next) => {
              if (!next) {
                reject(new Error('No available server ports found'));
                return;
              }
              portConfig.serverPort = next;
              retrying = true;
              serverProcess.kill();
              // Restart server
              startServer().then(resolve).catch(reject);
            });
          } catch (e) {
            reject(e);
          }
        }
      });
      
      serverProcess.on('error', (error) => {
        log(`❌ Failed to start server: ${error.message}`, 'red');
        if (error.code === 'ENOENT') {
          log('💡 Make sure Node.js and npm are installed and in your PATH', 'yellow');
          log('💡 On Windows, try running as Administrator or check your Node.js installation', 'yellow');
        }
        reject(error);
      });
      
      serverProcess.on('close', (code) => {
        if (retrying) {
          // We intentionally killed to retry on a new port; don't reject here.
          return;
        }
        if (code !== 0) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function startClient() {
  return new Promise(async (resolve, reject) => {
    try {
      const npmCmd = await findNpmCommand();
      clientStatus = 'starting';
      // Ensure we pick an available client port right before starting
      const desiredClientPort = await findAvailablePort(portConfig.clientPort || 9518) || 9518;
      if (desiredClientPort !== portConfig.clientPort) {
        log(`ℹ️  Selected free client port ${desiredClientPort} (was ${portConfig.clientPort})`, 'blue');
        portConfig.clientPort = desiredClientPort;
      }
      log(`🚀 Starting chess client on port ${portConfig.clientPort} using ${npmCmd}...`, 'yellow');
      
      // Pass the dynamic port to the client via environment variable
      const spawnOptions = {
        cwd: path.join(__dirname, 'client'),
        stdio: 'pipe',
        env: { 
          ...process.env, 
          VITE_PORT: portConfig.clientPort.toString(),
          VITE_SERVER_PORT: portConfig.serverPort.toString(),
          BROWSERSLIST_IGNORE_OLD_DATA: '1'
        }
      };
      
      // Use shell on Windows for better npm command handling
      if (isWindows) {
        spawnOptions.shell = true;
      }
      
      clientProcess = spawn(npmCmd, ['run', 'dev'], spawnOptions);
      
      let opened = false;
      let fallbackTimer = null;
      const lanIp = getLanIpRFC1918();
      const tryOpenFromOutput = (output) => {
        // Prefer "Network:" URL so share link matches what the frontend is actually using.
        let url = null;
        const netMatch = output.match(/Network:\s*(http:\/\/[0-9A-Za-z\.-]+:[0-9]{2,5})/i);
        if (netMatch && netMatch[1]) {
          url = netMatch[1];
        } else {
          const anyMatch = output.match(/(http:\/\/[0-9A-Za-z\.-]+:[0-9]{2,5})/i);
          if (anyMatch && anyMatch[1]) url = anyMatch[1];
        }
        if (url && !opened) {
          // Sync client port from parsed URL if different
          const portFromUrl = parseInt(url.split(':').pop(), 10);
          if (Number.isFinite(portFromUrl) && portFromUrl !== portConfig.clientPort) {
            portConfig.clientPort = portFromUrl;
          }
          opened = true;
          if (fallbackTimer) clearTimeout(fallbackTimer);
          setTimeout(() => {
            if (lanIp && lanIp !== 'localhost') {
              const lanUrl = `http://${lanIp}:${portConfig.clientPort}?server=${lanIp}`;
              openUrl(lanUrl);
            } else {
              openUrl(url);
            }
            notify('ChessVermouth', `Game opened in browser on port ${portConfig.clientPort}!`);
          }, 500);
          return true;
        }
        return false;
      };

      clientProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.toLowerCase().includes('local:') || output.includes('ready in') || output.includes(`:${portConfig.clientPort}`)) {
          // Try to open only when we can parse a URL; otherwise schedule a short fallback
          const openedNow = tryOpenFromOutput(output);
          if (!opened && !fallbackTimer) {
            fallbackTimer = setTimeout(() => {
              if (!opened) {
                const url = (lanIp && lanIp !== 'localhost')
                  ? `http://${lanIp}:${portConfig.clientPort}?server=${lanIp}`
                  : `http://localhost:${portConfig.clientPort}`;
                openUrl(url);
                notify('ChessVermouth', `Game opened in browser on port ${portConfig.clientPort}!`);
                opened = true;
              }
            }, 1500);
          }
          if (output.toLowerCase().includes('local:') || openedNow) {
            log(`✅ Client started successfully on port ${portConfig.clientPort}!`, 'green');
            log(`🌐 Client URL: http://localhost:${portConfig.clientPort}`, 'blue');
            clientStatus = 'ready';
            resolve();
          }
        }
      });
      
      clientProcess.stderr.on('data', (data) => {
        log(`Client error: ${data}`, 'red');
      });
      
      clientProcess.on('error', (error) => {
        log(`❌ Failed to start client: ${error.message}`, 'red');
        if (error.code === 'ENOENT') {
          log('💡 Make sure Node.js and npm are installed and in your PATH', 'yellow');
          log('💡 On Windows, try running as Administrator or check your Node.js installation', 'yellow');
        }
        reject(error);
      });
      
      clientProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Client exited with code ${code}`));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Developer-mode server start (uses nodemon via npm start)
async function startServerDev() {
  return new Promise(async (resolve, reject) => {
    try {
      const npmCmd = await findNpmCommand();
      const desiredServerPort = await findAvailablePort(portConfig.serverPort || 3001) || 3001;
      if (desiredServerPort !== portConfig.serverPort) {
        log(`ℹ️  Selected free server port ${desiredServerPort} (was ${portConfig.serverPort})`, 'blue');
        portConfig.serverPort = desiredServerPort;
      }
      log(`🚀 Starting chess server on port ${portConfig.serverPort} using nodemon...`, 'yellow');

      const lanIp = getLanIpRFC1918();

      const spawnOptions = {
        cwd: path.join(__dirname, 'server'),
        stdio: 'pipe',
        env: {
          ...process.env,
          PORT: portConfig.serverPort.toString(),
          LAN_IP: lanIp,
          ENGINE_HOST: '127.0.0.1',
          ENGINE_PORT: String(portConfig.enginePort)
        }
      };
      if (isWindows) spawnOptions.shell = true;

      serverProcess = spawn(npmCmd, ['run', 'start'], spawnOptions);

      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        // Pass through dev logs but detect readiness
        if (output.includes('Server is online')) {
          log(`✅ Server (dev) started on port ${portConfig.serverPort}`, 'green');
          notify('ChessVermouth', `Server ready on port ${portConfig.serverPort}`);
          resolve();
        }
      });
      serverProcess.stderr.on('data', (data) => {
        log(`Server error: ${data}`, 'red');
      });
      serverProcess.on('error', (error) => {
        log(`❌ Failed to start server (dev): ${error.message}`, 'red');
        reject(error);
      });
      serverProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Server (dev) exited with code ${code}`));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function ensureStockfish() {
  const bin = path.join(__dirname, 'engine', 'stockfish', 'stockfish');
  try {
    if (fs.existsSync(bin)) {
      try {
        fs.accessSync(bin, fs.constants.X_OK);
        return true;
      } catch (_) {
        // Try to chmod if present but not executable
        try { fs.chmodSync(bin, 0o755); return true; } catch (_) {}
      }
    }
  } catch (_) {}
  try {
    log('⬇️  Fetching Stockfish 17.1 binary...', 'blue');
    execSync('node scripts/fetch-stockfish.mjs', { stdio: 'inherit', cwd: __dirname });
    return true;
  } catch (err) {
    log('⚠️  Could not fetch Stockfish binary; engine will start without it', 'yellow');
    return false;
  }
}

async function startEngine(optional = true) {
  try {
    // Build latest engine server and ensure Stockfish is present
    log('🔧 Building engine server (latest)...', 'blue');
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
    await ensureStockfish();

    // Pick an available engine port and start engine HTTP+WS server
    const desiredEnginePort = await findAvailablePort(portConfig.enginePort || 8080) || 8080;
    if (desiredEnginePort !== portConfig.enginePort) {
      log(`ℹ️  Selected free engine port ${desiredEnginePort} (was ${portConfig.enginePort})`, 'blue');
      portConfig.enginePort = desiredEnginePort;
    }

    const spawnOptions = {
      cwd: __dirname,
      stdio: 'pipe',
      env: { ...process.env, PORT: String(portConfig.enginePort), HOST: '0.0.0.0' }
    };
    if (isWindows) spawnOptions.shell = true;
    engineProcess = spawn('node', ['dist/server.js'], spawnOptions);
    engineProcess.stdout.on('data', (d) => log(`Engine: ${String(d).trim()}`, 'magenta'));
    engineProcess.stderr.on('data', (d) => log(`Engine error: ${String(d).trim()}`, 'red'));

    // Health probe with short retries to avoid premature warnings
    engineStatus = 'starting';
    await new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 12; // ~6s total if intervalMs=500
      const intervalMs = 500;
      let announcedWait = false;
      const timer = setInterval(async () => {
        attempts++;
        try {
          const res = await httpGetJson(`http://127.0.0.1:${portConfig.enginePort}/health`, 1000);
          if (res.status === 200) {
            clearInterval(timer);
            engineStatus = 'ready';
            log(`✅ Engine online (${portConfig.enginePort})`, 'green');
            resolve(null);
            return;
          }
        } catch (_) {
          // ignore per-attempt errors
        }
        if (!announcedWait) {
          announcedWait = true;
          log('⏳ Waiting for engine to come online...', 'blue');
        }
      if (attempts >= maxAttempts) {
        clearInterval(timer);
        engineStatus = 'unavailable';
        log('⚠️  Engine not responding; hints/analysis disabled', 'yellow');
        resolve(null);
      }
    }, intervalMs);
  });
  } catch (err) {
    if (!optional) {
      log(`❌ Failed to start engine: ${err.message}`, 'red');
      throw err;
    } else {
      log('⚠️  Skipping engine start (optional). Hints/analysis may be unavailable.', 'yellow');
      engineStatus = 'unavailable';
    }
  }
}

async function startFullGame() {
  try {
    // Warn if Node < 18 as server proxy requires global fetch
    const nodeV = await checkNodeJS();
    const major = parseNodeMajor(nodeV);
    if (major < 18) {
      log(`❌ Node ${nodeV} detected. Node 18+ is required for LAN multiplayer (engine proxy needs global fetch).`, 'red');
      notify('ChessVermouth', 'Node 18+ required for LAN multiplayer');
      return;
    }

    // Start engine and let it settle concurrently while bringing up server/client
    const engineSettle = startEngine(true);
    await startServer();
    await startClient();
    // Wait for engine to be ready or unavailable
    await engineSettle;
    // Clear transient logs and show a concise status summary
    clearScreen();
    showAsciiBanner();
    printStatusSummary();
  } catch (error) {
    log(`❌ Failed to start game: ${error.message}`, 'red');
    notify('ChessVermouth', 'Failed to start game');
  }
}

async function startFullGameDev() {
  try {
    const nodeV = await checkNodeJS();
    const major = parseNodeMajor(nodeV);
    if (major < 18) {
      log(`❌ Node ${nodeV} detected. Node 18+ is required for LAN multiplayer (engine proxy needs global fetch).`, 'red');
      notify('ChessVermouth', 'Node 18+ required for LAN multiplayer');
      return;
    }

    const engineSettle = startEngine(true);
    await startServerDev();
    await startClient();
    await engineSettle;
    clearScreen();
    showAsciiBanner();
    printStatusSummary();
  } catch (error) {
    log(`❌ Failed to start game (dev): ${error.message}`, 'red');
    notify('ChessVermouth', 'Failed to start game (dev)');
  }
}

async function startHotSeatMode() {
  return new Promise(async (resolve, reject) => {
    try {
      const npmCmd = await findNpmCommand();
      log(`🎮 Starting Hot Seat Mode on port ${portConfig.clientPort} using ${npmCmd}...`, 'yellow');
      notify('ChessVermouth', 'Starting Hot Seat Mode');
      
      const spawnOptions = {
        cwd: path.join(__dirname, 'client'),
        stdio: 'pipe',
        env: { 
          ...process.env, 
          VITE_PORT: portConfig.clientPort.toString(),
          VITE_SERVER_PORT: portConfig.serverPort.toString()
        }
      };
      
      // Use shell on Windows for better npm command handling
      if (isWindows) {
        spawnOptions.shell = true;
      }
      
      // Ensure client dev port is available
      const desiredClientPort = await findAvailablePort(portConfig.clientPort || 9518) || 9518;
      if (desiredClientPort !== portConfig.clientPort) {
        log(`ℹ️  Selected free client port ${desiredClientPort} (was ${portConfig.clientPort})`, 'blue');
        portConfig.clientPort = desiredClientPort;
        spawnOptions.env.VITE_PORT = portConfig.clientPort.toString();
      }

      clientProcess = spawn(npmCmd, ['run', 'dev'], spawnOptions);
      
      let opened = false;
      let fallbackTimer = null;
      const tryOpenFromOutput = (output) => {
        const urlMatch = output.match(/(http:\/\/[0-9A-Za-z\.-]+:[0-9]{2,5})/i);
        if (urlMatch && urlMatch[1] && !opened) {
          const baseUrl = urlMatch[1];
          const portFromUrl = parseInt(baseUrl.split(':').pop(), 10);
          if (Number.isFinite(portFromUrl) && portFromUrl !== portConfig.clientPort) {
            portConfig.clientPort = portFromUrl;
          }
          const url = `${baseUrl}?mode=hotseat`;
          opened = true;
          if (fallbackTimer) clearTimeout(fallbackTimer);
          setTimeout(() => {
            openUrl(url);
            notify('ChessVermouth', 'Hot Seat Mode opened in browser!');
          }, 500);
          return true;
        }
        return false;
      };

      clientProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.toLowerCase().includes('local:') || output.includes('ready in') || output.includes(`:${portConfig.clientPort}`)) {
          const openedNow = tryOpenFromOutput(output);
          if (!opened && !fallbackTimer) {
            fallbackTimer = setTimeout(() => {
              if (!opened) {
                const url = `http://localhost:${portConfig.clientPort}?mode=hotseat`;
                openUrl(url);
                notify('ChessVermouth', 'Hot Seat Mode opened in browser!');
                opened = true;
              }
            }, 1500);
          }
          if (output.toLowerCase().includes('local:') || openedNow) {
            log(`✅ Hot Seat Mode ready on port ${portConfig.clientPort}!`, 'green');
            resolve();
          }
        }
      });
      
      clientProcess.stderr.on('data', (data) => {
        log(`Client error: ${data}`, 'red');
      });
      
      clientProcess.on('error', (error) => {
        log(`❌ Failed to start Hot Seat Mode: ${error.message}`, 'red');
        if (error.code === 'ENOENT') {
          log('💡 Make sure Node.js and npm are installed and in your PATH', 'yellow');
          log('💡 On Windows, try running as Administrator or check your Node.js installation', 'yellow');
        }
        reject(error);
      });
      
      clientProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Client exited with code ${code}`));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Menu system
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function showMenu() {
  showBanner();
  
  console.log('1️⃣  Play Chess Now (Network Multiplayer)');
  console.log('2️⃣  Hot Seat Mode (Local Two Players)');
  console.log('3️⃣  Start Server Only');
  console.log('4️⃣  Launch Game Only');
  console.log('5️⃣  Check System Status');
  console.log('6️⃣  Install Dependencies');
  console.log('7️⃣  Play Chess Now (Developer Mode)');
  console.log('8️⃣  Exit');
  console.log('');
  
  const choice = await askQuestion('Choose an option (1-8): ');
  
  switch (choice) {
    case '1':
      await startFullGame();
      break;
    case '2':
      await startHotSeatMode();
      break;
    case '3':
      // Start server + engine, no client
      await (async () => {
        const nodeV = await checkNodeJS();
        const major = parseNodeMajor(nodeV);
        if (major < 18) {
          log(`❌ Node ${nodeV} detected. Node 18+ is required for LAN multiplayer (engine proxy needs global fetch).`, 'red');
          notify('ChessVermouth', 'Node 18+ required');
          return;
        }
        const engineSettle = startEngine(true);
        await startServer();
        await engineSettle;
        clearScreen();
        showAsciiBanner();
        printStatusSummary();
      })();
      break;
    case '4':
      // Start frontend only and show summary
      await startClient();
      clearScreen();
      showAsciiBanner();
      printStatusSummary();
      break;
    case '5':
      await checkSystemStatus();
      break;
    case '6':
      await installDependencies();
      break;
    case '7':
      await startFullGameDev();
      break;
    case '8':
      log('👋 Goodbye! Thanks for using ChessVermouth.', 'cyan');
      process.exit(0);
      break;
    default:
      log('❌ Invalid choice. Please try again.', 'red');
  }
  
  console.log('');
  await askQuestion('Press Enter to continue...');
  await showMenu();
}

// Graceful shutdown
process.on('SIGINT', () => {
  log('\n🛑 Shutting down ChessVermouth...', 'yellow');
  
  if (serverProcess) {
    serverProcess.kill();
    log('Server stopped', 'blue');
  }
  
  if (clientProcess) {
    clientProcess.kill();
    log('Client stopped', 'blue');
  }
  if (engineProcess) {
    engineProcess.kill();
    log('Engine stopped', 'blue');
  }
  
  rl.close();
  process.exit(0);
});

// Main entry point
async function main() {
  try {
    showBanner();
    log('🚀 Starting ChessVermouth setup...', 'cyan');
    
    // Check if we're in the right directory
    if (!fs.existsSync('server') || !fs.existsSync('client')) {
      log('❌ Error: Please run this script from the ChessVermouth root directory', 'red');
      process.exit(1);
    }
    
    // Check dependencies first
    const deps = await checkDependencies();
    
    // Store dynamic ports
    portConfig.serverPort = deps.serverPort || 3001;
  portConfig.clientPort = deps.clientPort || 9518;
    
    if (!deps.node || !deps.npm) {
      log('⚠️  Node.js or npm not found', 'yellow');
      
      // Check if we're in interactive mode
      if (process.stdin.isTTY) {
        const install = await askQuestion('Would you like to install Node.js? (y/n): ');
        if (install.toLowerCase() === 'y') {
          await installNodeJS();
        } else {
          log('❌ Cannot proceed without Node.js. Please install it manually.', 'red');
          process.exit(1);
        }
      } else {
        log('❌ Node.js not found. Please install Node.js manually or run in interactive mode.', 'red');
        process.exit(1);
      }
    }
    
    // Check if we're in interactive mode
    if (!process.stdin.isTTY) {
      log('ℹ️  Running in non-interactive mode. Use interactive mode for menu.', 'yellow');
      log('ℹ️  Available commands:', 'blue');
      log('   node chessvermouth.js (interactive menu)', 'cyan');
      log('   npm install && npm run start (server)', 'cyan');
      log('   npm run dev (client)', 'cyan');
      if (isWindows) {
        log('💡 Windows users: Make sure Node.js is properly installed with npm in PATH', 'yellow');
        log('💡 If npm commands fail, try running in Command Prompt as Administrator', 'yellow');
      }
      rl.close();
      return;
    }
    
    // Show the main menu
    await showMenu();
    
  } catch (error) {
    log(`❌ Unexpected error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run if called directly (ESM-compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Optional CommonJS export guard (no-op under ESM)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { main, checkDependencies, installDependencies, startServer, startClient };
}
