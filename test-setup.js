#!/usr/bin/env node

/**
 * Simple test version of ChessVermouth setup
 * Focuses on core functionality without complex menu
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('♟️  ChessVermouth Setup Test');
console.log('============================');
console.log('');

// Check if we're in the right directory
if (!fs.existsSync('server') || !fs.existsSync('client')) {
  console.error('❌ Error: Please run this script from the ChessVermouth root directory');
  process.exit(1);
}

// Simple function to start server
function startServer() {
  console.log('🚀 Starting chess server...');
  
  const server = spawn('npm', ['run', 'start'], {
    cwd: path.join(__dirname, 'server'),
    stdio: 'inherit'
  });
  
  server.on('error', (error) => {
    console.error('❌ Server error:', error);
  });
  
  return server;
}

// Simple function to start client
function startClient() {
  console.log('🚀 Starting chess client...');
  
  const client = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, 'client'),
    stdio: 'inherit'
  });
  
  client.on('error', (error) => {
    console.error('❌ Client error:', error);
  });
  
  // Open browser after a delay
  setTimeout(() => {
    console.log('🌐 Opening browser...');
    const browserCmd = os.platform() === 'darwin' ? 'open' : 'start';
    spawn(browserCmd, ['http://localhost:5173']);
  }, 3000);
  
  return client;
}

// Check dependencies
console.log('🔍 Checking dependencies...');
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
  console.log(`✅ Node.js: ${nodeVersion}`);
  
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log(`✅ npm: ${npmVersion}`);
} catch (error) {
  console.error('❌ Node.js or npm not found');
  process.exit(1);
}

// Install dependencies if needed
console.log('');
console.log('📦 Installing dependencies...');

try {
  console.log('Installing server dependencies...');
  execSync('cd server && npm install', { stdio: 'inherit' });
  
  console.log('Installing client dependencies...');
  execSync('cd client && npm install', { stdio: 'inherit' });
  
  console.log('✅ Dependencies installed!');
} catch (error) {
  console.error('❌ Dependency installation failed');
  process.exit(1);
}

// Start the game
console.log('');
console.log('🎮 Starting ChessVermouth...');

const server = startServer();

// Wait a bit for server to start, then start client
setTimeout(() => {
  const client = startClient();
  
  console.log('');
  console.log('🎉 ChessVermouth is running!');
  console.log('📍 Game URL: http://localhost:5173');
  console.log('');
  console.log('Press Ctrl+C to stop both server and client');
}, 2000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  if (server) server.kill();
  process.exit(0);
});