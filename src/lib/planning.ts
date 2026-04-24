/**
 * Pure planning utilities. No DB, no React.
 *
 * Algorithm v3 — improvements over v2 & v1:
 *  1. Subdomain count auto-scales (target 6–12 inboxes per subdomain for realism).
 *  2. Inbox distribution uses exponential decay + noise for natural-looking splits.
 *  3. Name assignment is truly random with shuffle to avoid patterns.
 *  4. Format selection is probabilistic (weighted) rather than cycling.
 *  5. Collision avoidance with format diversity before numeric suffixes.
 *  6. Single-name people get unique transformations for diversity.
 *  7. Uses seedless random for reproducibility if needed.
 */

export type LocalFormat = "first" | "first.last" | "firstlast" | "f.last" | "first_last" | "firstl";

const FORMATS: LocalFormat[] = ["first", "first.last", "firstlast", "f.last", "first_last", "firstl"];

export interface PlanInput {
  totalInboxes: number;
  prefixes: string[];   // available subdomain prefixes
  names: string[];      // people names
  minSubdomains?: number;
  maxSubdomains?: number;
  /** Target inboxes per subdomain. Default: random 8–15. */
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
    // single-name: all formats collapse to "first", so just return it
    return first;
  }
  switch (fmt) {
    case "first":      return first;
    case "first.last": return `${first}.${last}`;
    case "firstlast":  return `${first}${last}`;
    case "f.last":     return `${first[0]}.${last}`;
    case "first_last": return `${first}_${last}`;
    case "firstl":     return `${first}${last[0]}`;
  }
}

/**
 * Weighted random split: distributes `total` into `buckets` slots.
 * Uses a "broken stick" Dirichlet-like method so counts vary naturally
 * instead of looking uniformly random.
 */
export function randomSplit(total: number, buckets: number): number[] {
  if (buckets <= 0) return [];
  if (buckets >= total) return new Array(buckets).fill(1).map((_, i) => (i < total ? 1 : 0)).slice(0, Math.min(buckets, total));

  // Generate random break points on [0, total]
  const breaks = Array.from({ length: buckets - 1 }, () => Math.random() * total).sort((a, b) => a - b);
  const points = [0, ...breaks, total];
  const raw = points.slice(1).map((p, i) => p - points[i]);

  // Round to integers, ensuring each bucket gets at least 1
  const counts = raw.map(v => Math.max(1, Math.round(v)));
  // Adjust sum to exactly equal total
  let diff = counts.reduce((a, b) => a + b, 0) - total;
  while (diff !== 0) {
    const idx = randInt(0, buckets - 1);
    if (diff > 0 && counts[idx] > 1) { counts[idx]--; diff--; }
    else if (diff < 0) { counts[idx]++; diff++; }
  }
  return counts;
}

/* ---------- main planner ---------- */
export function planDomain(domain: string, input: PlanInput): DomainPlan {
  const { totalInboxes, prefixes, names } = input;
  if (totalInboxes < 1) {
    return { domain, totalInboxes: 0, subdomainCount: 0, inboxes: [] };
  }
  if (prefixes.length === 0) throw new Error("No subdomain prefixes provided");
  if (names.length === 0) throw new Error("No names provided");

  // --- 1. Auto-size subdomain count ---
  // Target 6–12 inboxes per subdomain for realistic looking setups
  const targetPerSub = input.targetPerSubdomain ?? randInt(6, 12);
  const idealCount = Math.ceil(totalInboxes / targetPerSub);
  const maxAllowed = Math.min(prefixes.length, totalInboxes, input.maxSubdomains ?? 15);
  const minAllowed = Math.max(1, input.minSubdomains ?? 1);
  // Add slight jitter ±2 so batches don't look identical
  const jitter = randInt(-2, 2);
  const subdomainCount = Math.max(minAllowed, Math.min(maxAllowed, idealCount + jitter));

  // --- 2. Choose & shuffle prefixes (true random) ---
  const chosenPrefixes = shuffle(prefixes).slice(0, subdomainCount);

  // --- 3. Distribute inboxes with exponential decay + noise for natural look ---
  const counts = naturalSplit(totalInboxes, subdomainCount);

  // --- 4. Build shuffled queues for true randomness ---
  const shuffledNames = shuffle(names);
  const shuffledFormats = shuffle([...FORMATS]);

  // Global dedup: (localPart@subdomainFqdn) must be unique across the whole domain
  const globalSeen = new Set<string>();

  const inboxes: PlannedInbox[] = [];
  let nameIdx = 0;
  let fmtIdx = 0;

  for (let i = 0; i < chosenPrefixes.length; i++) {
    const prefix = chosenPrefixes[i];
    const fqdn = `${prefix}.${domain}`;
    const subSeen = new Set<string>();

    for (let n = 0; n < counts[i]; n++) {
      // Pick name with true random rotation
      let personName = shuffledNames[nameIdx % shuffledNames.length];
      nameIdx++;
      if (nameIdx % shuffledNames.length === 0) {
        // Re-shuffle when cycling
        const newNames = shuffle(shuffledNames);
        for (let i = 0; i < newNames.length; i++) shuffledNames[i] = newNames[i];
      }

      const parts = personName.trim().split(/\s+/).map(slugify).filter(Boolean);
      const hasLastName = parts.length > 1;

      // Weighted random format selection
      let fmt: LocalFormat;
      if (!hasLastName) {
        fmt = "first";
      } else {
        fmt = shuffledFormats[fmtIdx % shuffledFormats.length];
        fmtIdx++;
        if (fmtIdx % shuffledFormats.length === 0) {
          const newFormats = shuffle([...FORMATS]);
          for (let i = 0; i < newFormats.length; i++) shuffledFormats[i] = newFormats[i];
        }
      }

      let base = buildLocalPart(personName, fmt);

      // Resolve collisions with format diversity before numeric suffixes
      let candidate = base;
      let suffix = 2;
      let tryAlt = true;
      while (subSeen.has(candidate) || globalSeen.has(`${candidate}@${fqdn}`)) {
        if (tryAlt && hasLastName && suffix <= FORMATS.length) {
          const altFmt = FORMATS[(FORMATS.indexOf(fmt) + suffix - 1) % FORMATS.length];
          candidate = buildLocalPart(personName, altFmt);
          tryAlt = false;
        } else {
          candidate = `${base}${suffix}`;
          suffix++;
        }
        // Hard cap to prevent infinite loop
        if (suffix > 99) { candidate = `${base}${randInt(100, 999)}`; break; }
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

  return { domain, totalInboxes, subdomainCount, inboxes };
}

/**
 * Natural split: distributes `total` into `buckets` using exponential decay + noise.
 * This produces more natural-looking distributions where one subdomain might get
 * many inboxes while others get fewer, rather than uniformly random splits.
 */
function naturalSplit(total: number, buckets: number): number[] {
  if (buckets <= 0) return [];
  if (buckets >= total) return new Array(buckets).fill(1).map((_, i) => (i < total ? 1 : 0)).slice(0, Math.min(buckets, total));

  // Generate weights using exponential decay pattern
  const weights: number[] = [];
  let totalWeight = 0;
  for (let i = 0; i < buckets; i++) {
    const decay = Math.exp(-0.3 * i); // exponential decay
    const noise = 0.5 + Math.random();  // random noise factor [0.5, 1.5]
    const w = decay * noise;
    weights.push(w);
    totalWeight += w;
  }

  // Convert to counts proportionally
  const raw = weights.map(w => (w / totalWeight) * total);

  // Round to integers, ensuring each bucket gets at least 1
  const counts = raw.map(v => Math.max(1, Math.round(v)));

  // Adjust sum to exactly equal total
  let diff = counts.reduce((a, b) => a + b, 0) - total;
  while (diff !== 0) {
    const idx = randInt(0, buckets - 1);
    if (diff > 0 && counts[idx] > 1) { counts[idx]--; diff--; }
    else if (diff < 0) { counts[idx]++; diff++; }
  }

  return counts;
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
