const { execSync } = require('child_process');

// Print current directory for debugging
console.log('Current directory:', process.cwd());

try {
  // Navigate to web directory and run build
  console.log('Building web application...');
  execSync('cd web && pnpm install && pnpm run build', { stdio: 'inherit' });
  
  console.log('Build completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
} 