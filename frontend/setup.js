#!/usr/bin/env node

/**
 * GATeR Frontend Installation Script
 * Run this after creating all files to set up dependencies
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 GATeR Frontend Setup\n');

// Check if package.json exists
if (!fs.existsSync('package.json')) {
  console.error('❌ package.json not found. Make sure you\'re in the frontend directory.');
  process.exit(1);
}

console.log('📦 Installing dependencies...\n');

try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('\n✅ Dependencies installed successfully!\n');
} catch (error) {
  console.error('❌ Failed to install dependencies');
  process.exit(1);
}

// Check if .env.local exists
if (!fs.existsSync('.env.local')) {
  console.log('⚠️  .env.local not found. Creating template...\n');
  const envTemplate = `NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=change-this-to-a-random-secret-in-production
GITHUB_ID=your-github-oauth-app-id
GITHUB_SECRET=your-github-oauth-app-secret
NEXT_PUBLIC_FLASK_URL=http://127.0.0.1:5000
`;
  fs.writeFileSync('.env.local', envTemplate);
  console.log('✅ Created .env.local template. Please update with your values.\n');
}

console.log('✨ Setup complete!\n');
console.log('Next steps:');
console.log('1. Update .env.local with your GitHub OAuth credentials');
console.log('2. Start Flask backend: python ../web_server.py');
console.log('3. Start frontend: npm run dev');
console.log('4. Open http://localhost:3000\n');
