import { fromNodeRequest, toNodeResponse } from 'h3';
// @ts-ignore
import server from '../dist/server/server.js';

export default async function (req, res) {
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
