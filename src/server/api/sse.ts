import { defineEventHandler, getQuery, getHeader } from "h3";
import Redis from "ioredis";
import { createClient } from "@supabase/supabase-js";
import { users, domains } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Reuse a single connection or create one for SSE
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const domainId = query.domainId as string;

  if (!domainId) {
    return new Response("Missing domainId", { status: 400 });
  }

  // Check authentication
  const authHeader = getHeader(event, "authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Verify the token with Supabase
  const {
    data: { user: supabaseUser },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !supabaseUser) {
    return new Response("Invalid token", { status: 401 });
  }

  // Get database connection and verify user owns this domain
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.email, supabaseUser.email!),
  });

  if (!user) {
    return new Response("User not found", { status: 403 });
  }

  // Verify the domain belongs to the user
  const domain = await db.query.domains.findFirst({
    where: eq(domains.id, domainId),
  });

  if (!domain || domain.userId !== user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  const res = (event as any).node?.res;
  if (!res) return new Response("SSE not supported", { status: 500 });

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (typeof res.flushHeaders === "function") {
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
