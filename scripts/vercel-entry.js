// Post-build script: generates dist/server/index.js as the Vercel serverless function entry point.
// The TanStack Start build outputs dist/server/server.js, but Vercel expects an index.js.
// This file re-exports the default handler from the SSR build.
import { writeFileSync } from 'fs';

writeFileSync(
  'dist/server/index.js',
  `// Vercel Node.js serverless function entry point
// Re-exports the default handler from the TanStack Start SSR build
export default (await import('./server.js')).default;
`
);