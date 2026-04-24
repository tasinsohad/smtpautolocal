import { fromNodeRequest, toNodeResponse } from 'h3-v2';
// @ts-ignore
import server from '../dist/server/server.js';

export default async function (req, res) {
  // Check for critical environment variables at runtime
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    console.error('CRITICAL: Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY environment variables.');
  }

  try {
    // TanStack Start server exports a default object with a fetch method
    const response = await server.fetch(fromNodeRequest(req));
    await toNodeResponse(response, res);
  } catch (error) {
    console.error('SSR Error:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
