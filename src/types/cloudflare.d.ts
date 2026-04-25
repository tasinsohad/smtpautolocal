// Cloudflare Workers type declarations
// These extend the default Workers types for our application

import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';

declare global {
  interface CloudflareWorkersEnv {
    // D1 SQLite database binding
    DB: D1Database;
    
    // Static assets (for Workers with assets)
    ASSETS: {
      fetch: typeof fetch;
    };
    
    // Optional: KV for caching
    CACHE_KV?: KVNamespace;
    
    // Optional: R2 for file storage
    FILE_STORAGE?: R2Bucket;
  }
}

export {};