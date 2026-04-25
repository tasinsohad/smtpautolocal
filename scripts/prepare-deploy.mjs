import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read the wrangler.jsonc config for D1 database info
const wranglerConfigPath = join(rootDir, 'wrangler.jsonc');
let wranglerConfig = { d1_databases: [] };

if (existsSync(wranglerConfigPath)) {
  try {
    // Parse JSONC manually (simple regex-based strip of comments)
    const content = readFileSync(wranglerConfigPath, 'utf-8');
    const stripped = content
      .replace(/\/\/.*$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
    wranglerConfig = JSON.parse(stripped);
  } catch (e) {
    console.warn('Could not parse wrangler.jsonc:', e.message);
  }
}

// Create our deploy config for Cloudflare Workers
const deployConfig = {
  name: 'smtp-forge',
  main: 'dist/server/server.js',
  compatibility_date: '2024-04-01',
  compatibility_flags: ['nodejs_compat_v2'],
  // Include D1 databases from wrangler.jsonc (required for deployment)
  d1_databases: wranglerConfig.d1_databases || [],
  vars: {
    APP_ENV: 'production'
  },
  assets: {
    directory: 'dist/client',
  },
  // Edge compute optimization (requires Workers Paid plan)
  // Remove this section if on free tier
  placement: {
    mode: 'smart'
  },
  build: {
    upload_environment_variables: ['APP_ENV']
  }
};

const outputPath = join(rootDir, '.output/wrangler.deploy.json');
const outputDir = dirname(outputPath);

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

writeFileSync(outputPath, JSON.stringify(deployConfig, null, 2));
console.log('✓ Created .output/wrangler.deploy.json');
console.log('  Main entry:', deployConfig.main);
console.log('  Assets:', deployConfig.assets);
console.log('  D1 databases:', deployConfig.d1_databases.length);
console.log('');
console.log('Deploy with: wrangler deploy .output/wrangler.deploy.json');