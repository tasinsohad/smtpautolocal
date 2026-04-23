/**
 * Pure planning utilities. No DB, no React.
 *
 * Decides:
 *  - how many subdomains to use for a domain (random within bounds)
 *  - how to randomly distribute N inboxes across those subdomains (each ≥ 1)
 *  - which prefixes to assign per subdomain
 *  - which name + format to use per inbox
 *
 * Collisions on local_part within the same subdomain are resolved with a numeric suffix.
 */

export type LocalFormat = "first" | "first.last" | "firstlast" | "f.last" | "first_last" | "firstl";

const FORMATS: LocalFormat[] = ["first", "first.last", "firstlast", "f.last", "first_last", "firstl"];

export interface PlanInput {
  totalInboxes: number;
  prefixes: string[];   // available subdomain prefixes (e.g. ["mail","contact","hello"])
  names: string[];      // people names ("Alice", "John Doe", ...)
  /** Optional cap; defaults derive from totalInboxes. */
  minSubdomains?: number;
  maxSubdomains?: number;
}

export interface PlannedInbox {
  subdomainPrefix: string;
  subdomainFqdn: string;
  localPart: string;
  email: string;
  personName: string;
  format: LocalFormat;
}

export interface DomainPlan {
  domain: string;
  totalInboxes: number;
  subdomainCount: number;
  inboxes: PlannedInbox[];
}

/* ---------- helpers ---------- */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Distribute `total` items into `buckets` slots so each bucket gets ≥1. */
export function randomSplit(total: number, buckets: number): number[] {
  if (buckets <= 0) return [];
  if (buckets > total) buckets = total;
  // Start each bucket at 1, then drop the remaining randomly.
  const out = new Array(buckets).fill(1);
  let remaining = total - buckets;
  while (remaining > 0) {
    out[Math.floor(Math.random() * buckets)] += 1;
    remaining -= 1;
  }
  return out;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function buildLocalPart(name: string, fmt: LocalFormat): string {
  const parts = name.trim().split(/\s+/).map(slugify).filter(Boolean);
  const first = parts[0] ?? "user";
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  if (!last) return first; // single-name fallback
  switch (fmt) {
    case "first":        return first;
    case "first.last":   return `${first}.${last}`;
    case "firstlast":    return `${first}${last}`;
    case "f.last":       return `${first[0]}.${last}`;
    case "first_last":   return `${first}_${last}`;
    case "firstl":       return `${first}${last[0]}`;
  }
}

/* ---------- main planner ---------- */
export function planDomain(domain: string, input: PlanInput): DomainPlan {
  const { totalInboxes, prefixes, names } = input;
  if (totalInboxes < 1) {
    return { domain, totalInboxes: 0, subdomainCount: 0, inboxes: [] };
  }
  if (prefixes.length === 0) throw new Error("No subdomain prefixes provided");
  if (names.length === 0) throw new Error("No names provided");

  // Decide subdomain count: random within sensible bounds, capped by available prefixes.
  const lo = Math.max(1, input.minSubdomains ?? Math.min(2, totalInboxes));
  const hiCap = Math.min(prefixes.length, totalInboxes);
  const hi = Math.max(lo, Math.min(input.maxSubdomains ?? Math.min(8, hiCap), hiCap));
  const subdomainCount = randInt(lo, hi);

  // Assign prefixes (random distinct).
  const chosenPrefixes = shuffle(prefixes).slice(0, subdomainCount);

  // Distribute inboxes randomly per subdomain.
  const counts = randomSplit(totalInboxes, subdomainCount);

  const inboxes: PlannedInbox[] = [];
  for (let i = 0; i < chosenPrefixes.length; i++) {
    const prefix = chosenPrefixes[i];
    const fqdn = `${prefix}.${domain}`;
    const seenLocal = new Set<string>();
    for (let n = 0; n < counts[i]; n++) {
      const personName = pick(names);
      const fmt = pick(FORMATS);
      let local = buildLocalPart(personName, fmt);
      // Resolve collisions within the same subdomain
      let suffix = 2;
      let candidate = local;
      while (seenLocal.has(candidate)) {
        candidate = `${local}${suffix++}`;
      }
      seenLocal.add(candidate);
      inboxes.push({
        subdomainPrefix: prefix,
        subdomainFqdn: fqdn,
        localPart: candidate,
        email: `${candidate}@${fqdn}`,
        personName,
        format: fmt,
      });
    }
  }
  return { domain, totalInboxes, subdomainCount, inboxes };
}

/** Parse a textarea value into a clean unique list. */
export function parseList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}
