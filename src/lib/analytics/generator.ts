import { PLATFORMS, DEVICES, COUNTRIES } from "@/types/analytics";
import type { Platform, Device, Country } from "@/types/analytics";

// ─────────────────────────────────────────────────────────────────────────────
// Seeded PRNG (mulberry32) — the dataset is deterministic per seed so the UI,
// tests, and the README examples all describe the same data.
// ─────────────────────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller normal sample. */
function gaussian(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const CAMPAIGN_BRANDS = [
  "Aurora", "Nimbus", "Vertex", "Orbit", "Pulse", "Zenith", "Falcon", "Drift",
  "Ember", "Quasar", "Cobalt", "Summit", "Harbor", "Lumen", "Atlas", "Nova",
] as const;

const CAMPAIGN_KINDS = [
  "Prospecting", "Retargeting", "Brand Awareness", "Lookalike", "Search Core",
  "Shopping", "Video Reach", "Lead Gen", "App Install", "Promo",
] as const;

export interface CampaignSeed {
  id: string;
  name: string;
  platform: Platform;
  /** Multiplier on all volume — creates the power-law "top campaigns" shape. */
  scale: number;
  /** Base click-through rate for this campaign. */
  ctrBase: number;
  /** Base conversion rate for this campaign. */
  cvrBase: number;
  /** Cost per click baseline. */
  cpcBase: number;
}

export interface DatasetColumns {
  day: Int32Array;
  campaign: Uint16Array; // index into campaigns
  country: Uint8Array; // index into COUNTRIES
  device: Uint8Array; // index into DEVICES
  impressions: Float64Array;
  clicks: Uint32Array;
  conversions: Uint32Array;
  spend: Float64Array;
  revenue: Float64Array;
}

export interface GeneratedDataset {
  columns: DatasetColumns;
  campaigns: CampaignSeed[];
  /** Per-campaign daily seasonality weight (0..1) shared across channels. */
  weeklySeasonality: Float32Array;
}

export interface GenerateOptions {
  rowCount: number;
  startDay: number;
  endDay: number;
  seed?: number;
}

/** Realistic platform mix — not uniform. */
const PLATFORM_WEIGHTS: [Platform, number][] = [
  ["Google Ads", 0.32],
  ["Meta Ads", 0.27],
  ["LinkedIn Ads", 0.11],
  ["YouTube", 0.17],
  ["TikTok", 0.13],
];

const COUNTRY_WEIGHTS: [Country, number][] = [
  ["India", 0.2],
  ["United States", 0.24],
  ["United Kingdom", 0.13],
  ["Canada", 0.09],
  ["Australia", 0.08],
  ["Germany", 0.09],
  ["Singapore", 0.07],
  ["UAE", 0.1],
];

const DEVICE_WEIGHTS: [Device, number][] = [
  ["Desktop", 0.46],
  ["Mobile", 0.44],
  ["Tablet", 0.1],
];

const PLATFORM_CPC: Record<Platform, number> = {
  "Google Ads": 1.9,
  "Meta Ads": 1.1,
  "LinkedIn Ads": 5.8,
  YouTube: 0.8,
  TikTok: 0.55,
};

const PLATFORM_CTR: Record<Platform, number> = {
  "Google Ads": 0.045,
  "Meta Ads": 0.022,
  "LinkedIn Ads": 0.008,
  YouTube: 0.012,
  TikTok: 0.018,
};

function weightedPick<T extends string>(weights: [T, number][], r: number): T {
  let acc = 0;
  for (const [value, w] of weights) {
    acc += w;
    if (r <= acc) return value;
  }
  return weights[weights.length - 1][0];
}

/** Weighted sampler via cumulative lookup — O(1) after setup. */
function makeSampler<T extends string>(weights: [T, number][]): (rand: () => number) => T {
  const cum: number[] = [];
  const vals: T[] = [];
  let acc = 0;
  for (const [v, w] of weights) {
    acc += w;
    cum.push(acc);
    vals.push(v);
  }
  const total = acc;
  return (rand) => {
    const r = rand() * total;
    // binary search
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return vals[lo];
  };
}

export function generateCampaigns(seed: number, count: number): CampaignSeed[] {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const campaigns: CampaignSeed[] = [];
  for (let i = 0; i < count; i++) {
    const platform = weightedPick(PLATFORM_WEIGHTS, rand());
    const brand = CAMPAIGN_BRANDS[Math.floor(rand() * CAMPAIGN_BRANDS.length)];
    const kind = CAMPAIGN_KINDS[Math.floor(rand() * CAMPAIGN_KINDS.length)];
    const region = ["US", "IN", "EU", "UK", "APAC", "MEA"][Math.floor(rand() * 6)];
    // Zipf-ish scale: campaign 0 dominates, tail campaigns are small.
    const scale = 1 / (1 + i * 0.35) * (0.6 + rand() * 0.9);
    campaigns.push({
      id: `CMP-${String(1000 + i)}`,
      name: `${brand} ${kind} — ${platform.split(" ")[0]} ${region}`,
      platform,
      scale,
      ctrBase: PLATFORM_CTR[platform] * (0.55 + rand() * 1.1),
      cvrBase: 0.012 + rand() * 0.05,
      cpcBase: PLATFORM_CPC[platform] * (0.6 + rand() * 0.9),
    });
  }
  return campaigns;
}

/**
 * Generate `rowCount` realistic campaign-day records as columnar typed arrays.
 * Deterministic for a given (seed, rowCount, day range).
 */
export function generateDataset(opts: GenerateOptions): GeneratedDataset {
  const { rowCount, startDay, endDay, seed = 20260909 } = opts;
  const rand = mulberry32(seed);
  const days = endDay - startDay + 1;

  const campaigns = generateCampaigns(seed, 42);
  const pickPlatform = makeSampler(PLATFORM_WEIGHTS);
  const pickCountry = makeSampler(COUNTRY_WEIGHTS);
  const pickDevice = makeSampler(DEVICE_WEIGHTS);

  // Shared weekly seasonality: weekends dip, Mondays peak.
  const weekly = new Float32Array(days);
  for (let d = 0; d < days; d++) {
    const dow = (startDay + 4) % 7; // 1970-01-01 was a Thursday
    const weekendFactor = dow === 0 || dow === 6 ? 0.72 : 1;
    weekly[d] = weekendFactor * (1 + 0.15 * Math.sin((d / days) * Math.PI * 6)) * (1 + gaussian(rand) * 0.04);
  }

  const columns: DatasetColumns = {
    day: new Int32Array(rowCount),
    campaign: new Uint16Array(rowCount),
    country: new Uint8Array(rowCount),
    device: new Uint8Array(rowCount),
    impressions: new Float64Array(rowCount),
    clicks: new Uint32Array(rowCount),
    conversions: new Uint32Array(rowCount),
    spend: new Float64Array(rowCount),
    revenue: new Float64Array(rowCount),
  };

  // Campaign → dominant country/device bias so filters show real variation.
  const campaignCountry = new Uint8Array(campaigns.length);
  const campaignDevice = new Uint8Array(campaigns.length);
  for (let c = 0; c < campaigns.length; c++) {
    campaignCountry[c] = COUNTRIES.indexOf(pickCountry(rand));
    campaignDevice[c] = DEVICES.indexOf(pickDevice(rand));
  }

  for (let i = 0; i < rowCount; i++) {
    // Day: skew recent slightly (recency) — campaigns ramp over time.
    const t = Math.pow(rand(), 0.85);
    const dayIdx = Math.min(days - 1, Math.floor(t * days));

    // Campaign: zipf-weighted with noise.
    const ci = Math.min(campaigns.length - 1, Math.floor(Math.pow(rand(), 1.6) * campaigns.length));
    const camp = campaigns[ci];

    // 70% dominant country, 30% uniform — creates realistic geographic skew.
    const countryIdx = rand() < 0.7 ? campaignCountry[ci] : COUNTRIES.indexOf(pickCountry(rand));
    const deviceIdx = rand() < 0.75 ? campaignDevice[ci] : DEVICES.indexOf(pickDevice(rand));

    const season = weekly[dayIdx];
    const cpcJitter = 1 + gaussian(rand) * 0.18;
    const cpc = Math.max(0.08, camp.cpcBase * cpcJitter);
    const ctr = Math.max(0.001, camp.ctrBase * (0.75 + rand() * 0.6) * (deviceIdx === 1 ? 1.15 : 1));
    const cvr = Math.max(0.002, camp.cvrBase * (0.7 + rand() * 0.75) * (countryIdx === 0 ? 0.85 : 1));

    const impressions = Math.max(
      30,
      Math.round(9500 * camp.scale * season * (0.55 + rand() * 0.95) * (deviceIdx === 2 ? 0.45 : 1)),
    );
    const clicks = Math.max(1, Math.round(impressions * ctr));
    const conversions = Math.max(0, Math.round(clicks * cvr));
    const spend = clicks * cpc;
    // ROAS mostly 1.5–4.5, long tail down to ~0.6 and up to ~7.
    const roas = Math.max(0.4, 2.6 + gaussian(rand) * 1.15 + (ci < 6 ? 0.5 : 0));
    const revenue = spend * roas;

    columns.day[i] = startDay + dayIdx;
    columns.campaign[i] = ci;
    columns.country[i] = countryIdx;
    columns.device[i] = deviceIdx;
    columns.impressions[i] = impressions;
    columns.clicks[i] = clicks;
    columns.conversions[i] = conversions;
    columns.spend[i] = spend;
    columns.revenue[i] = revenue;
  }

  return { columns, campaigns, weeklySeasonality: weekly };
}

export { PLATFORMS, DEVICES, COUNTRIES };
