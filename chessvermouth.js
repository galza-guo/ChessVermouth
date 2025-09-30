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

// Helper function to find npm command
// defaults to 'npm' if not found
async function findNpmCommand() {
  return new Promise((resolve) => {
    // Try different npm command variations
    const npmCommands = isWindows ? ['npm.cmd', 'npm'] : ['npm'];
    
    for (const cmd of npmCommands) {
      exec(`which ${cmd}`, (error) => {
        if (!error) {
          resolve(cmd);
          return;
        }
      });
    }
    
    // Fallback: try to execute npm directly
    exec('npm --version', (error) => {
      if (!error) {
        resolve('npm');
      } else {
        // Last resort: check common Windows npm locations
        if (isWindows) {
          const commonPaths = [
            'C:\\Program Files\\nodejs\\npm.cmd',
            'C:\\Program Files (x86)\\nodejs\\npm.cmd',
            `${process.env.APPDATA}\\npm\\npm.cmd`,
            `${process.env.LOCALAPPDATA}\\npm\\npm.cmd`
          ];
          
          for (const npmPath of commonPaths) {
            if (fs.existsSync(npmPath)) {
              resolve(npmPath);
              return;
            }
          }
        }
        resolve('npm'); // Final fallback
      }
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
  
  // Find available ports dynamically
  log('🔍 Finding available ports...', 'blue');
  const serverPort = await findAvailablePort(3001);
  const clientPort = await findAvailablePort(5173);
  
  const results = {
    node: nodeVersion,
    npm: npmVersion,
    serverPort: serverPort,
    clientPort: clientPort,
    serverPortAvailable: serverPort !== null,
    clientPortAvailable: clientPort !== null
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
  
  if (serverPort) {
    log(`✅ Server port: ${serverPort} (available)`, 'green');
  } else {
    log('❌ No available server ports found (3001-3010)', 'red');
  }
  
  if (clientPort) {
    log(`✅ Client port: ${clientPort} (available)`, 'green');
  } else {
    log('❌ No available client ports found (5173-5182)', 'red');
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

// Dynamic port configuration
let portConfig = {
  serverPort: 3001,
  clientPort: 5173
};

async function startServer() {
  return new Promise(async (resolve, reject) => {
    try {
      const npmCmd = await findNpmCommand();
      log(`🚀 Starting chess server on port ${portConfig.serverPort} using ${npmCmd}...`, 'yellow');
      
      // Get local network info for display
      const os = require('os');
      const interfaces = os.networkInterfaces();
      let lanIp = 'localhost';
      for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
          if (interface.family === 'IPv4' && !interface.internal && interface.address.startsWith('192.168.')) {
            lanIp = interface.address;
            break;
          }
        }
        if (lanIp !== 'localhost') break;
      }
      
      if (lanIp !== 'localhost') {
        log(`🌐 Detected LAN IP: ${lanIp}`, 'blue');
        log(`📱 For LAN multiplayer, other devices connect to: http://${lanIp}:${portConfig.clientPort}?server=${lanIp}`, 'cyan');
      }
      
      // Pass the dynamic port to the server via environment variable
      const spawnOptions = {
        cwd: path.join(__dirname, 'server'),
        stdio: 'pipe',
        env: { 
          ...process.env, 
          PORT: portConfig.serverPort.toString(),
          LAN_IP: lanIp
        }
      };
      
      // Use shell on Windows for better npm command handling
      if (isWindows) {
        spawnOptions.shell = true;
      }
      
      serverProcess = spawn(npmCmd, ['run', 'start'], spawnOptions);
      
      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        log(`Server: ${output.trim()}`, 'blue'); // Show all server output
        
        if (output.includes('Server is online')) {
          log(`✅ Server started successfully on port ${portConfig.serverPort}!`, 'green');
          // Extract LAN IP from server output
          const lanIpMatch = output.match(/LAN IP for multiplayer: ([0-9.]+:[0-9]+)/);
          if (lanIpMatch) {
            log(`🌐 Server LAN address: ${lanIpMatch[1]}`, 'blue');
            log(`📱 Other players should connect to: http://${lanIpMatch[1].split(':')[0]}:${portConfig.clientPort}?server=${lanIpMatch[1].split(':')[0]}`, 'cyan');
          } else {
            // Try to extract any IP address from the output
            const anyIpMatch = output.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
            if (anyIpMatch && anyIpMatch[1] !== '127.0.0.1' && anyIpMatch[1] !== 'localhost') {
              log(`🌐 Detected server IP: ${anyIpMatch[1]}:${anyIpMatch[2]}`, 'blue');
              log(`📱 Other players should connect to: http://${anyIpMatch[1]}:${portConfig.clientPort}?server=${anyIpMatch[1]}`, 'cyan');
            }
          }
          notify('ChessVermouth', `Server is ready on port ${portConfig.serverPort}`);
          
          // Test network accessibility
          setTimeout(() => {
            const http = require('http');
            const options = {
              hostname: 'localhost',
              port: portConfig.serverPort,
              path: '/server-info',
              method: 'GET',
              timeout: 3000
            };
            
            const req = http.request(options, (res) => {
              let data = '';
              res.on('data', (chunk) => {
                data += chunk;
              });
              res.on('end', () => {
                try {
                  const serverInfo = JSON.parse(data);
                  log(`✅ Server network info: LAN IP ${serverInfo.lanIp}:${serverInfo.port}`, 'green');
                  if (serverInfo.lanIp && serverInfo.lanIp !== 'localhost') {
                    log(`🌐 For LAN multiplayer: http://${serverInfo.lanIp}:${portConfig.clientPort}?server=${serverInfo.lanIp}`, 'cyan');
                  }
                } catch (e) {
                  log('ℹ️  Server started but network info unavailable', 'yellow');
                }
              });
            });
            
            req.on('error', (e) => {
              log('⚠️  Could not verify server network status', 'yellow');
            });
            
            req.on('timeout', () => {
              req.destroy();
              log('⚠️  Server network check timed out', 'yellow');
            });
            
            req.end();
          }, 1000);
          
          resolve();
        }
      });
      
      serverProcess.stderr.on('data', (data) => {
        log(`Server error: ${data}`, 'red');
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
      log(`🚀 Starting chess client on port ${portConfig.clientPort} using ${npmCmd}...`, 'yellow');
      
      // Pass the dynamic port to the client via environment variable
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
      
      clientProcess = spawn(npmCmd, ['run', 'dev'], spawnOptions);
      
      clientProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('ready in') || output.includes(portConfig.clientPort.toString())) {
          log(`✅ Client started successfully on port ${portConfig.clientPort}!`, 'green');
          log(`🌐 Client URL: http://localhost:${portConfig.clientPort}`, 'blue');
          
          // Open browser
          setTimeout(() => {
            exec(`${config.browserCommand} http://localhost:${portConfig.clientPort}`);
            notify('ChessVermouth', `Game opened in browser on port ${portConfig.clientPort}!`);
          }, 2000);
          
          resolve();
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

async function startFullGame() {
  try {
    await startServer();
    await startClient();
    log('🎉 Chess game is ready! Enjoy playing!', 'green');
    log(`📍 Game URL: http://localhost:${portConfig.clientPort}`, 'blue');
  } catch (error) {
    log(`❌ Failed to start game: ${error.message}`, 'red');
    notify('ChessVermouth', 'Failed to start game');
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
      
      clientProcess = spawn(npmCmd, ['run', 'dev'], spawnOptions);
      
      clientProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('ready in') || output.includes(portConfig.clientPort.toString())) {
          log(`✅ Hot Seat Mode ready on port ${portConfig.clientPort}!`, 'green');
          
          // Open browser with hot seat parameter
          setTimeout(() => {
            exec(`${config.browserCommand} http://localhost:${portConfig.clientPort}?mode=hotseat`);
            notify('ChessVermouth', 'Hot Seat Mode opened in browser!');
          }, 2000);
          
          resolve();
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
  console.log('7️⃣  Exit');
  console.log('');
  
  const choice = await askQuestion('Choose an option (1-7): ');
  
  switch (choice) {
    case '1':
      await startFullGame();
      break;
    case '2':
      await startHotSeatMode();
      break;
    case '3':
      await startServer();
      break;
    case '4':
      await startClient();
      break;
    case '5':
      await checkDependencies();
      break;
    case '6':
      await installDependencies();
      break;
    case '7':
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
    
    // Store dynamic ports
    portConfig.serverPort = deps.serverPort || 3001;
    portConfig.clientPort = deps.clientPort || 5173;
    
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

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, checkDependencies, installDependencies, startServer, startClient };