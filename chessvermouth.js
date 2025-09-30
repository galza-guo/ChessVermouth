#!/usr/bin/env node

/**
 * ChessVermouth One-Click Setup & Launcher
 * macOS-First Cross-Platform Solution
 * 
 * Usage:
 *   node chessvermouth.js
 *   ./chessvermouth.js (if made executable)
 */

const { spawn, execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Platform detection and configuration
const platform = os.platform();
const isMacOS = platform === 'darwin';
const isWindows = platform === 'win32';
const isLinux = platform === 'linux';

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
}[platform] || config.darwin;

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
      execSync(`osascript -e 'display notification "${message}" with title "${title}" sound name "Glass"'`);
    } catch (e) {
      // Fallback to console if notification fails
    }
  }
  log(`🔔 ${title}: ${message}`, 'cyan');
}

function clearScreen() {
  console.clear();
}

function showBanner() {
  clearScreen();
  log('♟️  ChessVermouth Setup & Launcher', 'bright');
  log('=====================================', 'bright');
  log(`Optimized for ${config.name}`, 'blue');
  log('', 'reset');
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

async function checkDependencies() {
  log('🔍 Checking system dependencies...', 'yellow');
  
  const nodeVersion = await checkNodeJS();
  const npmVersion = await checkNPM();
  const serverPortAvailable = await checkPort(3001);
  const clientPortAvailable = await checkPort(5173);
  
  const results = {
    node: nodeVersion,
    npm: npmVersion,
    serverPort: serverPortAvailable,
    clientPort: clientPortAvailable
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
  
  if (serverPortAvailable) {
    log('✅ Server port 3001: Available', 'green');
  } else {
    log('⚠️  Server port 3001: In use', 'yellow');
  }
  
  if (clientPortAvailable) {
    log('✅ Client port 5173: Available', 'green');
  } else {
    log('⚠️  Client port 5173: In use', 'yellow');
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
    // Install server dependencies
    log('Installing server dependencies...', 'blue');
    execSync('cd server && npm install', { stdio: 'inherit' });
    
    // Install client dependencies
    log('Installing client dependencies...', 'blue');
    execSync('cd client && npm install', { stdio: 'inherit' });
    
    log('✅ Dependencies installed successfully!', 'green');
    notify('ChessVermouth', 'Dependencies installed successfully');
    return true;
  } catch (error) {
    log(`❌ Dependency installation failed: ${error.message}`, 'red');
    return false;
  }
}

// Process management
let serverProcess = null;
let clientProcess = null;

function startServer() {
  return new Promise((resolve, reject) => {
    log('🚀 Starting chess server...', 'yellow');
    
    serverProcess = spawn('npm', ['run', 'start'], {
      cwd: path.join(__dirname, 'server'),
      stdio: 'pipe'
    });
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server is online')) {
        log('✅ Server started successfully!', 'green');
        notify('ChessVermouth', 'Server is ready');
        resolve();
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      log(`Server error: ${data}`, 'red');
    });
    
    serverProcess.on('error', (error) => {
      reject(error);
    });
    
    serverProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

function startClient() {
  return new Promise((resolve, reject) => {
    log('🚀 Starting chess client...', 'yellow');
    
    clientProcess = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, 'client'),
      stdio: 'pipe'
    });
    
    clientProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('ready in') || output.includes('5173')) {
        log('✅ Client started successfully!', 'green');
        
        // Open browser
        setTimeout(() => {
          exec(`${config.browserCommand} http://localhost:5173`);
          notify('ChessVermouth', 'Game opened in browser!');
        }, 2000);
        
        resolve();
      }
    });
    
    clientProcess.stderr.on('data', (data) => {
      log(`Client error: ${data}`, 'red');
    });
    
    clientProcess.on('error', (error) => {
      reject(error);
    });
    
    clientProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Client exited with code ${code}`));
      }
    });
  });
}

async function startFullGame() {
  try {
    await startServer();
    await startClient();
    log('🎉 Chess game is ready! Enjoy playing!', 'green');
    log('📍 Game URL: http://localhost:5173', 'blue');
  } catch (error) {
    log(`❌ Failed to start game: ${error.message}`, 'red');
    notify('ChessVermouth', 'Failed to start game');
  }
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
  
  console.log('1️⃣  Play Chess Now (Server + Client)');
  console.log('2️⃣  Start Server Only');
  console.log('3️⃣  Launch Game Only');
  console.log('4️⃣  Check System Status');
  console.log('5️⃣  Install Dependencies');
  console.log('6️⃣  Exit');
  console.log('');
  
  const choice = await askQuestion('Choose an option (1-6): ');
  
  switch (choice) {
    case '1':
      await startFullGame();
      break;
    case '2':
      await startServer();
      break;
    case '3':
      await startClient();
      break;
    case '4':
      await checkDependencies();
      break;
    case '5':
      await installDependencies();
      break;
    case '6':
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

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, checkDependencies, installDependencies, startServer, startClient };