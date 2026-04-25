import { writeFileSync, readFileSync } from 'fs';

// Read the generated wrangler.json from the build
const generated = JSON.parse(readFileSync('dist/client/wrangler.json', 'utf-8'));

// Create our deploy config that includes the SSR server as main entry
const deployConfig = {
  name: generated.name,
  main: "../server/server.js",
  compatibility_date: generated.compatibility_date,
  // nodejs_compat_v2 provides full process.env and async_hooks support
  compatibility_flags: ["nodejs_compat_v2"],
  assets: generated.assets,
  d1_databases: generated.d1_databases,
  vars: generated.vars,
};

writeFileSync('dist/client/wrangler.deploy.json', JSON.stringify(deployConfig, null, 2));
console.log('Created dist/client/wrangler.deploy.json');
