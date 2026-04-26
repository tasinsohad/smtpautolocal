/**
 * Pure planning utilities. No DB, no React.
 *
 * Algorithm v4 — improvements for truly random, natural-looking output:
 *  1. Weighted prefix selection (common prefixes like mail/web more likely)
 *  2. Fisher-Yates shuffle for true randomness
 *  3. Weighted format selection (first.last most common)
 *  4. Exponential decay + noise for subdomain distribution
 *  5. Truly random name picking (not sequential)
 *  6. Random collision resolution with varied strategies
 */

export type LocalFormat = "first" | "first.last" | "firstlast" | "f.last" | "first_last" | "firstl";

const FORMATS: LocalFormat[] = [
  "first",
  "first.last",
  "firstlast",
  "f.last",
  "first_last",
  "firstl",
];

const FORMAT_WEIGHTS: Record<LocalFormat, number> = {
  "first": 20,
  "first.last": 35,
  "firstlast": 15,
  "f.last": 10,
  "first_last": 10,
  "firstl": 10,
};

const PREFIX_WEIGHTS: Record<string, number> = {
  "mail": 40,
  "web": 35,
  "app": 25,
  "api": 20,
  "shop": 15,
  "blog": 12,
  "dev": 10,
  "cloud": 10,
  "portal": 8,
  "info": 6,
  "support": 8,
  "news": 5,
  "forum": 4,
  "cdn": 3,
  "static": 3,
  "assets": 2,
};

export interface PlanInput {
  totalInboxes: number;
  prefixes: string[];
  names: string[];
  minSubdomains?: number;
  maxSubdomains?: number;
  targetPerSubdomain?: number;
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
  subdomainDistribution: Record<string, number>;
  inboxes: PlannedInbox[];
}

/* ---------- random helpers ---------- */
function rand(): number {
  return Math.random();
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return rand() * (max - min) + min;
}

function weightedRandom<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample<T>(arr: T[], count: number): T[] {
  const shuffled = shuffle(arr);
  return shuffled.slice(0, Math.min(count, arr.length));
}

function sampleUnique<T>(arr: T[], count: number): T[] {
  if (count >= arr.length) return shuffle(arr);
  const result: T[] = [];
  const pool = [...arr];
  for (let i = 0; i < count; i++) {
    const idx = randInt(0, pool.length - 1);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
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
  if (!last) {
    return first;
  }
  switch (fmt) {
    case "first":
      return first;
    case "first.last":
      return `${first}.${last}`;
    case "firstlast":
      return `${first}${last}`;
    case "f.last":
      return `${first[0]}.${last}`;
    case "first_last":
      return `${first}_${last}`;
    case "firstl":
      return `${first}${last[0]}`;
  }
}

function selectWeightedFormat(): LocalFormat {
  const weights = Object.values(FORMAT_WEIGHTS);
  return weightedRandom(FORMATS, weights);
}

function getPrefixWeight(prefix: string): number {
  return PREFIX_WEIGHTS[prefix.toLowerCase()] ?? randInt(1, 5);
}

function selectWeightedPrefix(availablePrefixes: string[]): string {
  const weights = availablePrefixes.map(p => getPrefixWeight(p));
  return weightedRandom(availablePrefixes, weights);
}

/* ---------- main planner ---------- */
export function planDomain(domain: string, input: PlanInput): DomainPlan {
  const { totalInboxes, prefixes, names } = input;
  if (totalInboxes < 1) {
    return { domain, totalInboxes: 0, subdomainCount: 0, inboxes: [] };
  }
  if (prefixes.length === 0) throw new Error("No subdomain prefixes provided");
  if (names.length === 0) throw new Error("No names provided");

  const minAllowed = Math.max(3, input.minSubdomains ?? 3);
  const maxAllowed = input.maxSubdomains ?? 15;

  const subdomainCount = randInt(minAllowed, maxAllowed);
  
  if (subdomainCount > prefixes.length) subdomainCount = prefixes.length;
  
  if (subdomainCount > prefixes.length) subdomainCount = prefixes.length;

  const chosenPrefixes = sampleUnique(prefixes, subdomainCount);

  const counts = naturalSplit(totalInboxes, subdomainCount);

  const shuffledNames = shuffle(names);
  const shuffledFormats = shuffle([...FORMATS]);

  const globalSeen = new Set<string>();
  const inboxes: PlannedInbox[] = [];
  const subdomainDistribution: Record<string, number> = {};
  
  let namePool = [...shuffledNames];
  let formatPool = [...shuffledFormats];

  for (let i = 0; i < chosenPrefixes.length; i++) {
    const prefix = chosenPrefixes[i];
    const fqdn = `${prefix}.${domain}`;
    const subSeen = new Set<string>();
    subdomainDistribution[prefix] = 0;

    for (let n = 0; n < counts[i]; n++) {
      if (namePool.length === 0) {
        namePool = shuffle([...names]);
      }
      const personName = namePool.pop()!;
      subdomainDistribution[prefix]++;

      const parts = personName.trim().split(/\s+/).map(slugify).filter(Boolean);
      const hasLastName = parts.length > 1;

      let fmt: LocalFormat;
      if (!hasLastName) {
        fmt = "first";
      } else {
        if (formatPool.length === 0) {
          formatPool = shuffle([...FORMATS]);
        }
        fmt = formatPool.pop()!;
      }

      const base = buildLocalPart(personName, fmt);

      let candidate = base;
      let suffix = randInt(2, 5);
      let strategy = randInt(0, 2);

      while (subSeen.has(candidate) || globalSeen.has(`${candidate}@${fqdn}`)) {
        switch (strategy % 3) {
          case 0:
            candidate = base + randInt(10, 99);
            break;
          case 1:
            candidate = `${base}${randInt(1, 9)}${String.fromCharCode(97 + randInt(0, 25))}`;
            break;
          default:
            candidate = `${base}_${suffix}`;
            suffix += randInt(1, 3);
        }
        
        if (suffix > 999) {
          candidate = `${base}${randInt(1000, 9999)}`;
          break;
        }
        strategy++;
      }

      subSeen.add(candidate);
      globalSeen.add(`${candidate}@${fqdn}`);

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

  return { domain, totalInboxes, subdomainCount, subdomainDistribution, inboxes };
}

function naturalSplit(total: number, buckets: number): number[] {
  if (buckets <= 0) return [];
  if (buckets >= total) {
    return new Array(buckets)
      .fill(1)
      .map((_, i) => (i < total ? 1 : 0))
      .slice(0, Math.min(buckets, total));
  }

  const MIN_PER_SUBDOMAIN = 2;
  const MAX_PER_SUBDOMAIN = 8;
  
  const counts: number[] = [];
  const target = Math.floor(total / buckets);
  
  for (let i = 0; i < buckets; i++) {
    let count;
    if (i === 0) {
      count = randInt(Math.min(3, total), Math.min(MAX_PER_SUBDOMAIN, total));
    } else {
      count = randInt(MIN_PER_SUBDOMAIN, MAX_PER_SUBDOMAIN);
    }
    counts.push(count);
  }
  
  const currentSum = counts.reduce((a, b) => a + b, 0);
  const diff = total - currentSum;
  
  let adjustCount = 0;
  while (counts.reduce((a, b) => a + b, 0) !== total && adjustCount < 50) {
    const runningSum = counts.reduce((a, b) => a + b, 0);
    const newDiff = total - runningSum;
    
    if (newDiff > 0) {
      const idx = randInt(0, buckets - 1);
      if (counts[idx] < MAX_PER_SUBDOMAIN) {
        counts[idx]++;
      }
    } else if (newDiff < 0) {
      const idx = randInt(0, buckets - 1);
      if (counts[idx] > MIN_PER_SUBDOMAIN) {
        counts[idx]--;
      }
}
    }
    adjustCount++;
  }

  return counts;
}

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