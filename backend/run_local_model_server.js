#!/usr/bin/env node

/**
 * Local Model Server Script for Majd Platform
 * 
 * This script sets up and runs a local model server for the Majd platform,
 * providing access to locally deployed models for cost optimization and privacy.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Configuration
const DEFAULT_MODEL_PATH = path.join(__dirname, '..', 'models', 'deepseek-r1-distill-qwen-7b');
const DEFAULT_PORT = 8000;

// Parse command line arguments
const args = process.argv.slice(2);
let modelPath = DEFAULT_MODEL_PATH;
let port = DEFAULT_PORT;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model' && i + 1 < args.length) {
    modelPath = args[i + 1];
    i++;
  } else if (args[i] === '--port' && i + 1 < args.length) {
    port = parseInt(args[i + 1], 10);
    i++;
  }
}

// Check if model exists
if (!fs.existsSync(modelPath)) {
  console.error(`Error: Model not found at ${modelPath}`);
  console.log('Please download the model first or specify the correct path with --model');
  process.exit(1);
}

// Check if Python is installed
const checkPython = spawn('python3', ['--version']);
checkPython.on('error', (err) => {
  console.error('Error: Python3 is not installed or not in PATH');
  console.log('Please install Python 3.10 or higher');
  process.exit(1);
});

// Start the model server
console.log(`Starting local model server with model: ${modelPath}`);
console.log(`Server will be available at: http://localhost:${port}/v1/chat/completions`);

const serverProcess = spawn('python3', [
  '-m', 'vllm.entrypoints.openai.api_server',
  '--model', modelPath,
  '--port', port.toString(),
  '--host', '0.0.0.0'
]);

// Handle server output
serverProcess.stdout.on('data', (data) => {
  console.log(`[Server] ${data.toString().trim()}`);
});

serverProcess.stderr.on('data', (data) => {
  console.error(`[Server Error] ${data.toString().trim()}`);
});

// Handle server exit
serverProcess.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Handle script termination
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  serverProcess.kill();
  process.exit(0);
});

// Create readline interface for interactive commands
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'local-model> '
});

rl.prompt();

rl.on('line', (line) => {
  const command = line.trim();
  
  if (command === 'exit' || command === 'quit') {
    console.log('Shutting down server...');
    serverProcess.kill();
    process.exit(0);
  } else if (command === 'status') {
    console.log(`Server running at: http://localhost:${port}/v1/chat/completions`);
    console.log(`Model: ${modelPath}`);
  } else if (command === 'help') {
    console.log('Available commands:');
    console.log('  status - Show server status');
    console.log('  exit/quit - Shut down server and exit');
    console.log('  help - Show this help message');
  } else if (command) {
    console.log(`Unknown command: ${command}`);
    console.log('Type "help" for available commands');
  }
  
  rl.prompt();
});
