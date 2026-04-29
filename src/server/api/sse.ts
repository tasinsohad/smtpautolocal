import { defineEventHandler, getQuery } from "h3";
import Redis from "ioredis";

// Reuse a single connection or create one for SSE
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const domainId = query.domainId as string;

  if (!domainId) {
    return new Response("Missing domainId", { status: 400 });
  }

  const res = (event as any).node?.res;
  if (!res) return new Response("SSE not supported", { status: 500 });

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const subscriber = redis.duplicate();
  const channel = `server-log:${domainId}`;

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ msg: "Connected to terminal stream" })}\n\n`);

  subscriber.subscribe(channel, (err) => {
    if (err) {
      console.error("Redis subscribe error:", err);
      res.write(`data: ${JSON.stringify({ error: "Failed to subscribe" })}\n\n`);
    }
  });

  subscriber.on("message", (ch, message) => {
    if (ch === channel) {
      res.write(`data: ${message}\n\n`);
    }
  });

  // Handle client disconnect
  const req = (event as any).node?.req;
  if (req) {
    req.on("close", () => {
      subscriber.unsubscribe(channel);
      subscriber.quit();
    });
  }
});
