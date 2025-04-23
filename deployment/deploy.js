#!/usr/bin/env node

/**
 * Majd Complete Platform Deployment Script
 * 
 * This script deploys the complete Majd platform including:
 * 1. Backend API server
 * 2. Frontend GUI on www.majd.chat
 * 3. Configuration for both components
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuration
const config = {
  backendDir: path.resolve(__dirname, '..', 'backend'),
  frontendDir: path.resolve(__dirname, '..', 'frontend'),
  deploymentOptions: [
    'vercel',
    'custom',
    'local-development'
  ]
};

// Main deployment function
async function deploy() {
  console.log('\n🚀 Starting Majd Complete Platform Deployment\n');
  
  try {
    // Select deployment target
    const deploymentTarget = await selectDeploymentTarget();
    
    // Deploy backend
    await deployBackend(deploymentTarget);
    
    // Deploy frontend
    await deployFrontend(deploymentTarget);
    
    // Configure domain
    if (deploymentTarget === 'vercel') {
      await configureDomain();
    }
    
    console.log('\n✅ Deployment completed successfully!\n');
    console.log('Your Majd platform is now deployed and ready to use.');
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.error('Please fix the issues and try again.');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Select deployment target
async function selectDeploymentTarget() {
  console.log('📋 Available deployment targets:');
  config.deploymentOptions.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option}`);
  });
  
  const selection = await askQuestion(`\nSelect a deployment target (1-${config.deploymentOptions.length}): `);
  
  const index = parseInt(selection) - 1;
  if (isNaN(index) || index < 0 || index >= config.deploymentOptions.length) {
    throw new Error('Invalid selection.');
  }
  
  return config.deploymentOptions[index];
}

// Deploy backend
async function deployBackend(target) {
  console.log('\n📦 Deploying backend...');
  
  // Check if backend directory exists
  if (!fs.existsSync(config.backendDir)) {
    throw new Error(`Backend directory not found: ${config.backendDir}`);
  }
  
  // Change to backend directory
  process.chdir(config.backendDir);
  
  switch (target) {
    case 'vercel':
      await deployBackendToVercel();
      break;
    case 'custom':
      await deployBackendToCustom();
      break;
    case 'local-development':
      await setupBackendForLocalDevelopment();
      break;
    default:
      throw new Error(`Unsupported backend deployment target: ${target}`);
  }
  
  console.log('✅ Backend deployment completed');
}

// Deploy frontend
async function deployFrontend(target) {
  console.log('\n🎨 Deploying frontend...');
  
  // Check if frontend directory exists
  if (!fs.existsSync(config.frontendDir)) {
    throw new Error(`Frontend directory not found: ${config.frontendDir}`);
  }
  
  // Change to frontend directory
  process.chdir(config.frontendDir);
  
  switch (target) {
    case 'vercel':
      await deployFrontendToVercel();
      break;
    case 'custom':
      await deployFrontendToCustom();
      break;
    case 'local-development':
      await setupFrontendForLocalDevelopment();
      break;
    default:
      throw new Error(`Unsupported frontend deployment target: ${target}`);
  }
  
  console.log('✅ Frontend deployment completed');
}

// Deploy backend to Vercel
async function deployBackendToVercel() {
  console.log('  Deploying backend to Vercel...');
  
  // Check if Vercel CLI is installed
  try {
    execSync('vercel --version', { stdio: 'pipe' });
  } catch (error) {
    console.log('  Installing Vercel CLI...');
    execSync('npm install -g vercel', { stdio: 'inherit' });
  }
  
  // Check if user is logged in to Vercel
  const isLoggedIn = await checkVercelLogin();
  if (!isLoggedIn) {
    console.log('  Please log in to Vercel:');
    execSync('vercel login', { stdio: 'inherit' });
  }
  
  // Configure backend for Vercel
  await configureBackendForVercel();
  
  // Deploy to Vercel
  console.log('  Deploying backend to Vercel...');
  execSync('vercel --prod', { stdio: 'inherit' });
  
  // Get deployment URL
  const deploymentUrl = execSync('vercel --prod --confirm').toString().trim();
  console.log(`  Backend deployed to: ${deploymentUrl}`);
  
  // Save backend URL for frontend configuration
  fs.writeFileSync(path.resolve(config.frontendDir, '.env.local'), `NEXT_PUBLIC_API_URL=${deploymentUrl}`);
  
  return deploymentUrl;
}

// Deploy frontend to Vercel
async function deployFrontendToVercel() {
  console.log('  Deploying frontend to Vercel...');
  
  // Check if Vercel CLI is installed
  try {
    execSync('vercel --version', { stdio: 'pipe' });
  } catch (error) {
    console.log('  Installing Vercel CLI...');
    execSync('npm install -g vercel', { stdio: 'inherit' });
  }
  
  // Check if user is logged in to Vercel
  const isLoggedIn = await checkVercelLogin();
  if (!isLoggedIn) {
    console.log('  Please log in to Vercel:');
    execSync('vercel login', { stdio: 'inherit' });
  }
  
  // Configure frontend for Vercel
  await configureFrontendForVercel();
  
  // Deploy to Vercel
  console.log('  Deploying frontend to Vercel...');
  execSync('vercel --prod', { stdio: 'inherit' });
  
  // Get deployment URL
  const deploymentUrl = execSync('vercel --prod --confirm').toString().trim();
  console.log(`  Frontend deployed to: ${deploymentUrl}`);
  
  return deploymentUrl;
}

// Configure domain
async function configureDomain() {
  console.log('\n🌐 Configuring domain...');
  
  const setupDomain = await askQuestion('  Do you want to configure the domain www.majd.chat? (y/n): ');
  if (setupDomain.toLowerCase() !== 'y') {
    console.log('  Skipping domain configuration');
    return;
  }
  
  console.log(`
To configure the domain www.majd.chat:

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your frontend project
3. Go to "Settings" > "Domains"
4. Add your domain: www.majd.chat
5. Follow the instructions to configure your DNS settings

For the backend API:
1. Go to your Vercel dashboard and select your backend project
2. Go to "Settings" > "Domains"
3. Add your API domain: api.majd.chat
4. Configure your DNS settings as instructed

After configuring your domains, update your frontend environment variables:
1. Go to your frontend project in Vercel dashboard
2. Go to "Settings" > "Environment Variables"
3. Add or update NEXT_PUBLIC_API_URL to https://api.majd.chat
4. Add or update NEXT_PUBLIC_SITE_URL to https://www.majd.chat
5. Redeploy your frontend project
`);
  
  const confirmed = await askQuestion('  Have you completed the domain configuration? (y/n): ');
  if (confirmed.toLowerCase() === 'y') {
    console.log('  Domain configuration completed');
  } else {
    console.log('  Please complete the domain configuration later');
  }
}

// Deploy backend to custom environment
async function deployBackendToCustom() {
  console.log(`
To deploy the backend to a custom environment:

1. Set up your server environment with Node.js 16+ and npm
2. Copy the backend directory to your server
3. Install dependencies:
   npm install --production
4. Set up environment variables in .env file
5. Start the server:
   npm start

For production use, we recommend using PM2:
1. Install PM2:
   npm install -g pm2
2. Start the application:
   pm2 start src/index.js --name majd-backend
3. Configure PM2 to start on system boot:
   pm2 startup
   pm2 save

If you're using Nginx as a reverse proxy:
server {
    listen 80;
    server_name api.majd.chat;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`);
  
  const confirmed = await askQuestion('  Have you completed the custom backend deployment? (y/n): ');
  if (confirmed.toLowerCase() === 'y') {
    console.log('  Custom backend deployment completed');
  } else {
    console.log('  Please complete the custom backend deployment later');
  }
}

// Deploy frontend to custom environment
async function deployFrontendToCustom() {
  console.log(`
To deploy the frontend to a custom environment:

1. Set up your server environment with Node.js 16+ and npm
2. Copy the frontend directory to your server
3. Install dependencies:
   npm install
4. Build the application:
   npm run build
5. Start the server:
   npm start

For production use with PM2:
1. Install PM2:
   npm install -g pm2
2. Start the application:
   pm2 start npm --name majd-frontend -- start
3. Configure PM2 to start on system boot:
   pm2 startup
   pm2 save

If you're using Nginx as a reverse proxy:
server {
    listen 80;
    server_name www.majd.chat;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`);
  
  const confirmed = await askQuestion('  Have you completed the custom frontend deployment? (y/n): ');
  if (confirmed.toLowerCase() === 'y') {
    console.log('  Custom frontend deployment completed');
  } else {
    console.log('  Please complete the custom frontend deployment later');
  }
}

// Set up backend for local development
async function setupBackendForLocalDevelopment() {
  console.log('  Setting up backend for local development...');
  
  // Install dependencies
  console.log('  Installing backend dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  
  // Create .env file if it doesn't exist
  if (!fs.existsSync('.env')) {
    console.log('  Creating .env file...');
    fs.copyFileSync('.env.example', '.env');
  }
  
  // Run setup script
  console.log('  Running setup script...');
  execSync('node scripts/setup.js', { stdio: 'inherit' });
  
  console.log(`
Backend setup for local development completed.

To start the backend server:
  npm run dev

The server will be available at http://localhost:3000
`);
}

// Set up frontend for local development
async function setupFrontendForLocalDevelopment() {
  console.log('  Setting up frontend for local development...');
  
  // Install dependencies
  console.log('  Installing frontend dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  
  // Create .env.local file
  console.log('  Creating .env.local file...');
  fs.writeFileSync('.env.local', 'NEXT_PUBLIC_API_URL=http://localhost:3000\nNEXT_PUBLIC_SITE_URL=http://localhost:3001');
  
  console.log(`
Frontend setup for local development completed.

To start the frontend server:
  npm run dev

The frontend will be available at http://localhost:3001

Make sure the backend server is running at http://localhost:3000
`);
}

// Configure backend for Vercel
async function configureBackendForVercel() {
  console.log('  Configuring backend for Vercel...');
  
  // Create vercel.json if it doesn't exist
  if (!fs.existsSync('vercel.json')) {
    const vercelConfig = {
      "version": 2,
      "builds": [
        {
          "src": "src/index.js",
          "use": "@vercel/node"
        }
      ],
      "routes": [
        {
          "src": "/(.*)",
          "dest": "src/index.js"
        }
      ],
      "env": {
        "NODE_ENV": "production"
      }
    };
    
    fs.writeFileSync('vercel.json', JSON.stringify(vercelConfig, null, 2));
  }
  
  // Create .vercelignore if it doesn't exist
  if (!fs.existsSync('.vercelignore')) {
    fs.writeFileSync('.vercelignore', 'node_modules\n.env\nlogs\ndata\nstorage');
  }
}

// Configure frontend for Vercel
async function configureFrontendForVercel() {
  console.log('  Configuring frontend for Vercel...');
  
  // Create .vercelignore if it doesn't exist
  if (!fs.existsSync('.vercelignore')) {
    fs.writeFileSync('.vercelignore', 'node_modules\n.next\nout');
  }
}

// Check if user is logged in to Vercel
async function checkVercelLogin() {
  try {
    const result = execSync('vercel whoami', { stdio: 'pipe' }).toString();
    return !result.includes('Error');
  } catch (error) {
    return false;
  }
}

// Helper function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Run deployment
deploy();
