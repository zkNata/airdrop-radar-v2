// Airdrop Radar — the value model (radar-3).
//
// The board ranks pre-token protocols by an implied launch value fitted on the
// snapshot's own traded comparables, never on a hand-written list of names.
//
// The fit (see dashboard for the chart and the numbers):
//   log(market cap) = 8.0718 + 0.4524 * log(TVL)
//                     + 0.003 * growth_clamped + log(maturity)
//   growth_clamped = clamp(change_7d, -60, 120), per cent
//   maturity       = 0.8 + 0.2 * min(age_days, 1095) / 1095
//   age unknown    -> 990 days (the median age of the traded comparables)
//
// The shipped constants ARE the TVL-only OLS fit on the 111 comparables:
// the program refits it at runtime (validateModel) and reports the refit
// beside the shipped numbers, so a stale constant cannot hide. The growth
// and maturity terms are small bounded priors, not fitted loadings: the free
// fit's growth loading is -0.02 (se 0.03) and its log-age loading is -0.36
// (se 0.31) — both indistinguishable from zero — and the free fit scores
// WORSE out of sample (5-fold R2 0.09 vs 0.13 for the size curve), so the
// model keeps the economically required signs as small bounded priors
// instead of fitting noise. The maturity prior is a stated choice, and the
// free fit is shown next to it so the choice can be checked.
//
// Validation, all recomputed from the snapshot by this program (folds by
// sorted-slug index mod 5; cohort splits by listing date; bootstrap with a
// fixed seed, 200 refits). The out-of-sample numbers refit the size curve
// on the training set only, so they are clean holdouts; the shipped
// formula's own scores are reported beside them:
//   shipped model, in-sample R2 0.13; size curve, 5-fold out-of-sample R2
//   0.13, leave-one-out R2 0.12 (house starter: -0.08 on all three)
//   median out-of-sample miss x3.3; 5-fold residual P10 -2.59, P90 +2.08
//   in log points — the P10-P90 band on every row comes from those
//   residuals, so a $20M point estimate reads $1.5M-$160M
//   listing-cohort splits (dated comparables only, n=85), size curve refit
//   on the older listings: fit before 2023, test 2023+: R2 0.07; before
//   2024: 0.05; before 2025: -0.28. The 2025 cohort FAILS: the size curve
//   fitted on older listings does not transfer to the newest listings.
//   Rolling by listing year: 2023: 0.12, 2024: 0.16, 2025: -0.20. The
//   model beats the house starter on every split (starter: -0.24, -0.28,
//   -0.72 on the cuts), but a negative R2 is a negative R2: do not read the
//   point estimates as predictions.
//   bootstrap (200 refits): elasticity P10 0.34, P50 0.46, P90 0.57.
//   Tested and rejected on this snapshot: free growth+maturity (5-fold
//   0.09, LOO 0.08), shrunk category offsets (5-fold 0.13, LOO 0.11,
//   cohort-2025 -0.28), Huber robust fit (5-fold 0.13, LOO 0.12).
//
// Every row's farm plan is derived from the same record (category, chains,
// TVL, age) and is netted to the dollar: gas per transaction by chain,
// opportunity cost of the locked capital at 5% a year, and a FARM / THIN /
// SKIP verdict from the net cost against the implied value. FARM and THIN
// rows also carry why the verdict was given (catalyst, band, margin), the
// risks in the record, and the exit rule; SKIP rows carry why they were
// skipped. The plan is a rule of thumb, not a promise: a token may never
// launch, and the P10 of the band is the number to farm against, not the
// point estimate.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  intercept: number;
  elasticity: number;
  growth_tilt: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  /** Annual opportunity cost applied to locked farm capital. */
  apr: number;
}

export const MODEL: ModelConstants = {
  intercept: 8.0718,
  elasticity: 0.4524,
  growth_tilt: 0.003,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.8,
  maturity_range: 0.2,
  maturity_days: 1095,
  unknown_age_days: 990,
  apr: 0.05,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** Bootstrap refits behind the rank ranges and coefficient bands. */
export const BOOTSTRAP_REFITS = 200;
/** The bootstrap's fixed seed: the same snapshot gives the same refits. */
export const BOOTSTRAP_SEED = 20261114;

/** One cohort split's result: who was fitted, who was tested, and the R2s. */
export interface CohortResult {
  train: number;
  test: number;
  /** Size curve refit on the training listings only (clean holdout). */
  r2: number | null;
  /** The shipped formula's own score on the same test listings. */
  r2_shipped: number | null;
  /** The house starter's score on the same test listings. */
  r2_starter: number | null;
}

/** Everything the dashboard reports about the fit and its validation. */
export interface Validation {
  comps: number;
  traded_total: number;
  excluded_dead: number;
  excluded_cex_bridge: number;
  dated_comps: number;
  /** The shipped formula's R2 on all 111 comparables. */
  r2_in_sample: number;
  /** Size curve refit per fold (clean holdout). */
  r2_oos_5fold: number;
  /** Size curve refit per comparable (clean holdout). */
  r2_loo: number;
  r2_in_sample_starter: number;
  r2_oos_starter: number;
  r2_loo_starter: number;
  /** Median out-of-sample miss as a multiple (exp of the median |residual|). */
  median_miss_x: number;
  /** 5-fold out-of-sample residual quantiles, in log points: the band's width. */
  band_log_p10: number;
  band_log_p90: number;
  /** The TVL-only OLS refit on this snapshot, beside the shipped constants. */
  ols_intercept: number;
  ols_elasticity: number;
  ols_intercept_se: number;
  ols_elasticity_se: number;
  bootstrap_refits: number;
  bootstrap_elasticity_p10: number;
  bootstrap_elasticity_p50: number;
  bootstrap_elasticity_p90: number;
  bootstrap_intercept_p10: number;
  bootstrap_intercept_p50: number;
  bootstrap_intercept_p90: number;
  /** The free fit's loadings, with standard errors: what the data says by itself. */
  free_growth_coef: number;
  free_growth_se: number;
  free_log_age_coef: number;
  free_log_age_se: number;
  free_log_maturity_coef: number;
  free_log_maturity_se: number;
  cohort_cut_2023: CohortResult;
  cohort_cut_2024: CohortResult;
  cohort_cut_2025: CohortResult;
  rolling_2023: CohortResult;
  rolling_2024: CohortResult;
  rolling_2025: CohortResult;
  cohort_reverse_2025: CohortResult;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  /** P10-P90 band from the 5-fold out-of-sample residuals, in whole dollars. */
  implied_value_p10_usd: number;
  implied_value_p90_usd: number;
  /** Rank range over the bootstrap refits: how stable this rank is. */
  rank_p10: number;
  rank_p90: number;
  model: {
    intercept: number;
    elasticity: number;
    growth_pct: number;
    growth_tilt: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
  /** Netted farm economics, in whole dollars, and the verdict. */
  farm_economics: {
    capital_usd: number;
    gas_usd: number;
    opportunity_usd: number;
    net_usd: number;
    verdict: 'FARM' | 'THIN' | 'SKIP';
  };
}

/** The dashboard's compact view of one row (arrays keep data.js small). */
export type RadarRow = [
  rank: number,
  slug: string,
  name: string,
  category: string | null,
  chains: string,
  tvl_usd: number,
  change_7d: number | null,
  age_days: number | null,
  implied_value_usd: number,
  implied_value_p10_usd: number,
  implied_value_p90_usd: number,
  rank_p10: number,
  rank_p90: number,
  on_watchlist: number,
  chain_count: number,
];

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export type LiveRow = [
  slug: string,
  name: string,
  category: string | null,
  chains: string,
  tvl_usd: number,
  mcap_usd: number | null,
  change_7d: number | null,
];

/** Everything the dashboard needs: the board, the live set, the fit and the model. */
export interface RadarData {
  v: string;
  as_of: string;
  floor_usd: number;
  model: ModelConstants;
  fit: Validation;
  /** [log TVL, log mcap] of the 111 fitted comparables, rounded to 3 decimals. */
  comps: [number, number][];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The three multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): { implied: number; growthPct: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const logValue = model.intercept + model.elasticity * Math.log(protocol.tvl_usd) + model.growth_tilt * growthPct + Math.log(maturityMult);
  const implied = Math.max(1, Math.round(Math.exp(logValue)));
  return { implied, growthPct, maturityMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

// ---------------------------------------------------------------- validation
// Everything here is a pure function of the snapshot, so the program reports
// the same numbers on every run. Folds are by sorted-slug index mod 5;
// cohort splits are by listing date; the bootstrap uses a fixed seed.

interface Comp {
  slug: string;
  category: string | null;
  tvl: number;
  y: number;
  x: number;
  g: number;
  age: number | null;
  lm: number;
  listed: string | null;
}

/** The fitted comparables: traded, priced, not an exchange or a bridge. */
function compsOf(snapshot: Snapshot): Comp[] {
  return snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.category !== 'CEX' && p.category !== 'Canonical Bridge')
    .map((p) => {
      const age = ageDays(snapshot.as_of, p.listed_at);
      const ageForModel = age ?? MODEL.unknown_age_days;
      const mat = MODEL.maturity_floor + (Math.min(Math.max(ageForModel, 0), MODEL.maturity_days) / MODEL.maturity_days) * MODEL.maturity_range;
      return {
        slug: p.slug,
        category: p.category,
        tvl: p.tvl_usd,
        y: Math.log(p.mcap_usd!),
        x: Math.log(p.tvl_usd),
        g: Math.min(MODEL.growth_cap, Math.max(MODEL.growth_floor, finite(p.change_7d, 0))),
        age,
        lm: Math.log(mat),
        listed: p.listed_at,
      };
    })
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/** Ordinary least squares on `feats`, with coefficients, standard errors and R2. */
function ols(rows: Comp[], feats: ((c: Comp) => number)[]): { beta: number[]; se: number[]; r2: number; resid: number[] } {
  const k = feats.length + 1;
  const X = rows.map((r) => [1, ...feats.map((f) => f(r))]);
  const y = rows.map((r) => r.y);
  const A: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const b: number[] = new Array<number>(k).fill(0);
  for (let i = 0; i < rows.length; i++) {
    for (let a = 0; a < k; a++) {
      b[a]! += X[i]![a]! * y[i]!;
      for (let c = 0; c < k; c++) A[a]![c]! += X[i]![a]! * X[i]![c]!;
    }
  }
  const M = A.map((row, i) => [...row, ...Array.from({ length: k }, (_, j) => (j === i ? 1 : 0))]);
  for (let col = 0; col < k; col++) {
    let piv = col;
    for (let r = col + 1; r < k; r++) if (Math.abs(M[r]![col]!) > Math.abs(M[piv]![col]!)) piv = r;
    const tmp = M[col]!;
    M[col] = M[piv]!;
    M[piv] = tmp;
    const d = M[col]![col]!;
    for (let j = 0; j < 2 * k; j++) M[col]![j]! /= d;
    for (let r = 0; r < k; r++) {
      if (r === col) continue;
      const f = M[r]![col]!;
      for (let j = 0; j < 2 * k; j++) M[r]![j]! -= f * M[col]![j]!;
    }
  }
  const inv = M.map((row) => row.slice(k));
  const beta = inv.map((row) => row.reduce((s, v, j) => s + v * b[j]!, 0));
  const resid = rows.map((r, i) => y[i]! - beta.reduce((s, v, j) => s + v * X[i]![j]!, 0));
  const sse = resid.reduce((s, e) => s + e * e, 0);
  const mean = y.reduce((s, v) => s + v, 0) / y.length;
  const sst = y.reduce((s, v) => s + (v - mean) ** 2, 0);
  const s2 = sse / Math.max(1, rows.length - k);
  return { beta, se: beta.map((_, j) => Math.sqrt(s2 * inv[j]![j]!)), r2: 1 - sse / sst, resid };
}

/** R2 of predictions against actuals, test-set mean: negative when worse than the mean. */
function r2Of(pred: number[], actual: number[]): number | null {
  if (actual.length < 3) return null;
  const mean = actual.reduce((s, v) => s + v, 0) / actual.length;
  const sse = pred.reduce((s, p, i) => s + (actual[i]! - p) ** 2, 0);
  const sst = actual.reduce((s, v) => s + (v - mean) ** 2, 0);
  if (sst === 0) return null;
  return 1 - sse / sst;
}

/** The shipped model's log-value prediction for a comparable. */
function shippedPred(c: Comp): number {
  return MODEL.intercept + MODEL.elasticity * c.x + MODEL.growth_tilt * c.g + c.lm;
}

/** The house starter's log-value prediction for a comparable. */
function starterPred(c: Comp): number {
  const ageForModel = c.age ?? 365;
  const mat = 0.6 + (Math.min(Math.max(ageForModel, 0), 1095) / 1095) * 0.4;
  const growthMult = 1 + (c.g / 100) * 0.5;
  return Math.log(Math.max(1, 0.25 * c.tvl * growthMult * mat));
}

/** The q-quantile of a sorted array, linear interpolation. */
function quant(sorted: number[], q: number): number {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

/** A seeded PRNG (mulberry32): the bootstrap is the same on every run. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

const TVL_ONLY: ((c: Comp) => number)[] = [(c) => c.x];

/** The whole validation, computed from the snapshot. */
export function validateModel(snapshot: Snapshot): Validation {
  const comps = compsOf(snapshot);
  const dated = comps.filter((c) => c.listed !== null);
  const tradedTotal = snapshot.protocols.filter((p) => p.mcap_usd !== null).length;
  const excludedDead = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd <= 0).length;
  const excludedCexBridge = snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && (p.category === 'CEX' || p.category === 'Canonical Bridge'),
  ).length;

  const fitA = ols(comps, TVL_ONLY);
  const freeFit = ols(comps, [(c) => c.x, (c) => c.g, (c) => c.lm]);
  const freeAge = ols(comps, [(c) => c.x, (c) => c.g, (c) => Math.log((c.age ?? MODEL.unknown_age_days) + 1)]);

  const r2In = r2Of(comps.map(shippedPred), comps.map((c) => c.y)) ?? 0;
  const r2InStarter = r2Of(comps.map(starterPred), comps.map((c) => c.y)) ?? 0;

  // Clean-holdout 5-fold: each fold's model is refit without that fold.
  // The residuals behind the band and the median miss come from these.
  const oosPred = new Array<number>(comps.length).fill(0);
  for (let fold = 0; fold < 5; fold++) {
    const train = comps.filter((_, i) => i % 5 !== fold);
    const f = ols(train, TVL_ONLY);
    comps.forEach((c, i) => {
      if (i % 5 === fold) oosPred[i] = f.beta[0]! + f.beta[1]! * c.x;
    });
  }
  const oosResid = comps.map((c, i) => c.y - oosPred[i]!);
  const oosSorted = [...oosResid].sort((a, b) => a - b);
  const absSorted = oosResid.map((e) => Math.abs(e)).sort((a, b) => a - b);
  const r2Oos = r2Of(oosPred, comps.map((c) => c.y)) ?? 0;

  // Clean-holdout leave-one-out.
  const looPred: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const train = comps.filter((_, j) => j !== i);
    const f = ols(train, TVL_ONLY);
    looPred.push(f.beta[0]! + f.beta[1]! * comps[i]!.x);
  }
  const r2Loo = r2Of(looPred, comps.map((c) => c.y)) ?? 0;

  const cohort = (train: Comp[], test: Comp[]): CohortResult => {
    const f = ols(train, TVL_ONLY);
    const refitPred = test.map((c) => f.beta[0]! + f.beta[1]! * c.x);
    return {
      train: train.length,
      test: test.length,
      r2: r2Of(refitPred, test.map((c) => c.y)),
      r2_shipped: r2Of(test.map(shippedPred), test.map((c) => c.y)),
      r2_starter: r2Of(test.map(starterPred), test.map((c) => c.y)),
    };
  };
  const cut = (iso: string): CohortResult =>
    cohort(
      dated.filter((c) => c.listed! < iso),
      dated.filter((c) => c.listed! >= iso),
    );
  const rolling = (year: string): CohortResult =>
    cohort(
      dated.filter((c) => c.listed! < `${year}-01-01`),
      dated.filter((c) => c.listed!.slice(0, 4) === year),
    );

  // Bootstrap: 200 refits of the TVL-only fit on resampled comparables.
  const rnd = mulberry32(BOOTSTRAP_SEED);
  const slopes: number[] = [];
  const intercepts: number[] = [];
  let done = 0;
  for (let b = 0; b < BOOTSTRAP_REFITS; b++) {
    const sample = Array.from({ length: comps.length }, () => comps[Math.floor(rnd() * comps.length)]!);
    try {
      const f = ols(sample, TVL_ONLY);
      intercepts.push(f.beta[0]!);
      slopes.push(f.beta[1]!);
      done++;
    } catch {
      // A resample too degenerate to fit is skipped; the count is reported.
    }
  }
  slopes.sort((a, b) => a - b);
  intercepts.sort((a, b) => a - b);

  return {
    comps: comps.length,
    traded_total: tradedTotal,
    excluded_dead: excludedDead,
    excluded_cex_bridge: excludedCexBridge,
    dated_comps: dated.length,
    r2_in_sample: round3(r2In),
    r2_oos_5fold: round3(r2Oos),
    r2_loo: round3(r2Loo),
    r2_in_sample_starter: round3(r2InStarter),
    r2_oos_starter: round3(r2InStarter),
    r2_loo_starter: round3(r2InStarter),
    median_miss_x: round3(Math.exp(quant(absSorted, 0.5))),
    band_log_p10: round3(quant(oosSorted, 0.1)),
    band_log_p90: round3(quant(oosSorted, 0.9)),
    ols_intercept: round4(fitA.beta[0]!),
    ols_elasticity: round4(fitA.beta[1]!),
    ols_intercept_se: round4(fitA.se[0]!),
    ols_elasticity_se: round4(fitA.se[1]!),
    bootstrap_refits: done,
    bootstrap_elasticity_p10: round4(quant(slopes, 0.1)),
    bootstrap_elasticity_p50: round4(quant(slopes, 0.5)),
    bootstrap_elasticity_p90: round4(quant(slopes, 0.9)),
    bootstrap_intercept_p10: round4(quant(intercepts, 0.1)),
    bootstrap_intercept_p50: round4(quant(intercepts, 0.5)),
    bootstrap_intercept_p90: round4(quant(intercepts, 0.9)),
    free_growth_coef: round4(freeFit.beta[2]!),
    free_growth_se: round4(freeFit.se[2]!),
    free_log_age_coef: round4(freeAge.beta[3]!),
    free_log_age_se: round4(freeAge.se[3]!),
    free_log_maturity_coef: round4(freeFit.beta[3]!),
    free_log_maturity_se: round4(freeFit.se[3]!),
    cohort_cut_2023: cut('2023-01-01'),
    cohort_cut_2024: cut('2024-01-01'),
    cohort_cut_2025: cut('2025-01-01'),
    rolling_2023: rolling('2023'),
    rolling_2024: rolling('2024'),
    rolling_2025: rolling('2025'),
    cohort_reverse_2025: cohort(
      dated.filter((c) => c.listed! >= '2025-01-01'),
      dated.filter((c) => c.listed! < '2025-01-01'),
    ),
  };
}

// ---------------------------------------------------------------- board

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL, validation?: Validation): BoardRow[] {
  const v = validation ?? validateModel(snapshot);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const { implied, growthPct, maturityMult, age } = impliedValue(p, snapshot.as_of, model);
    return { p, implied, growthPct, maturityMult, age };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const rows = scored.map((s, i) => {
    const econ = farmEconomics(s.p, s.age, s.implied);
    const p10 = Math.max(1, Math.round(s.implied * Math.exp(v.band_log_p10)));
    const p90 = Math.max(1, Math.round(s.implied * Math.exp(v.band_log_p90)));
    const steps = farmSteps(s.p, s.age, s.implied, econ, snapshot.watchlist.includes(s.p.slug), { p10, p90 });
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      age_days: s.age,
      implied_value_usd: s.implied,
      implied_value_p10_usd: p10,
      implied_value_p90_usd: p90,
      rank_p10: 0,
      rank_p90: 0,
      model: {
        intercept: model.intercept,
        elasticity: model.elasticity,
        growth_pct: s.growthPct,
        growth_tilt: model.growth_tilt,
        maturity_multiplier: round4(s.maturityMult),
        age_days: s.age,
      },
      farm_steps: steps.map(stepText),
      farm_economics: econ,
    };
  });
  // Rank ranges over the bootstrap refits: for each refit, re-rank this same
  // set of protocols by the refitted size curve and record each rank.
  const ranksBySlug = new Map<string, number[]>();
  const rnd = mulberry32(BOOTSTRAP_SEED);
  const comps = compsOf(snapshot);
  for (let b = 0; b < BOOTSTRAP_REFITS; b++) {
    const sample = Array.from({ length: comps.length }, () => comps[Math.floor(rnd() * comps.length)]!);
    let f: { beta: number[] };
    try {
      f = ols(sample, TVL_ONLY);
    } catch {
      continue;
    }
    const scoredB = rows.map((r) => {
      const p = index.get(r.slug)!;
      const { growthPct, maturityMult } = impliedValue(p, snapshot.as_of, model);
      const logValue = f.beta[0]! + f.beta[1]! * Math.log(p.tvl_usd) + model.growth_tilt * growthPct + Math.log(maturityMult);
      return { slug: r.slug, logValue };
    });
    scoredB.sort((a, b) => b.logValue - a.logValue || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    scoredB.forEach((s, i) => {
      const arr = ranksBySlug.get(s.slug) ?? [];
      arr.push(i + 1);
      ranksBySlug.set(s.slug, arr);
    });
  }
  for (const r of rows) {
    const arr = (ranksBySlug.get(r.slug) ?? [r.rank]).sort((a, b) => a - b);
    r.rank_p10 = Math.max(1, Math.round(quant(arr, 0.1)));
    r.rank_p90 = Math.min(rows.length, Math.round(quant(arr, 0.9)));
  }
  return rows;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** A dollar amount as the dashboard writes it. */
function fmtUsd(n: number): string {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return '$' + Math.round(n);
}

/** A small dollar amount, cents kept. */
function fmtMoney(n: number): string {
  return '$' + (Math.round(n * 100) / 100);
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The second chain a protocol names, or null. */
function secondChainOf(p: SnapshotProtocol): string | null {
  return p.chains.length > 1 ? p.chains[1]! : null;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Gas for one transaction on a chain, in whole dollars (typical, not a quote). */
export function gasPerTx(chain: string): number {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 8;
  if (c === 'solana' || c === 'sui' || c === 'aptos') return 1;
  if (c === 'tron') return 1;
  if (c === 'binance') return 1;
  if (['base', 'arbitrum', 'optimism', 'polygon', 'zksync era', 'linea', 'blast', 'scroll', 'unichain', 'ink', 'katana', 'corn', 'monad', 'arc', 'abstract', 'soneium', 'mode', 'fraxtal', 'zora', 'world chain'].includes(c)) return 1;
  if (c === 'avalanche' || c === 'fantom' || c === 'celo' || c === 'gnosis' || c === 'xdai') return 1;
  return 2;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('stak') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('farm')) return `Deposit $${capital} of USDC into ${name}'s farm on ${chain} and keep the position open.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second qualifying action on the same chain, different from the first. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const half = Math.max(10, Math.round(capital / 2));
  if (c.includes('dex') || c.includes('yield')) return `Swap $${half} through ${name} on ${chain} so the wallet shows trading activity as well as liquidity.`;
  if (c.includes('lend') || c.includes('cdp')) return `Borrow $${half} against the deposit on ${name} and repay it within the same week.`;
  if (c.includes('stak') || c.includes('restak')) return `Delegate a further $${half} through ${name} on ${chain} and keep both receipts.`;
  if (c.includes('bridge')) return `Bridge $${half} back through ${name} so the wallet shows two-way use.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Close the hedge on ${name} and open one new small position.`;
  return `Use $${half} in a second feature of ${name} on ${chain}, such as a swap or a vote.`;
}

/** The 7-day change as the dashboard sees it: rounded to 2 decimals, so the
 *  record's clauses read the same in the board and on the page. */
function dispGrowth(p: SnapshotProtocol): number {
  const g = finite(p.change_7d, 0);
  return Math.round(g * 100) / 100;
}

/** The risks in the record, as short clauses (at most two). */
function riskClauses(p: SnapshotProtocol, age: number | null, floorUsd: number): string[] {
  const out: string[] = [];
  const g = dispGrowth(p);
  if (p.change_7d === null) out.push('no 7-day change reported');
  else if (g < -10) out.push(`TVL fell ${Math.abs(g).toFixed(1)}% in 7 days`);
  if (age === null) out.push('listing date unknown');
  else if (age < 180) out.push('tracked under 6 months');
  if (p.chains.length === 1) out.push('all TVL sits on one chain');
  if (p.tvl_usd < floorUsd) out.push('below the $50M watchlist floor');
  return out.slice(0, 2);
}

/** The catalysts in the record, as short clauses (at most two). */
function catalystClauses(p: SnapshotProtocol, age: number | null, onWatchlist: boolean): string[] {
  const out: string[] = [];
  const g = dispGrowth(p);
  if (p.change_7d !== null && g > 10) out.push(`TVL grew ${g.toFixed(1)}% in 7 days`);
  if (onWatchlist) out.push('on the $50M+ watchlist');
  if (p.chains.length >= 3) out.push(`TVL spread across ${p.chains.length} chains`);
  if (age !== null && age >= 1095) out.push('tracked over 3 years');
  return out.slice(0, 2);
}

/**
 * A protocol's farm plan: nine steps for FARM / THIN, eight for SKIP.
 * The first three are the action plan's setup (as in radar-2); the why-step
 * states the verdict's reason, the catalyst, the band and the real risk;
 * the risk-step states the risks in the record and the exit rule. Every
 * clause is derived from the protocol's own record, never from a
 * hand-written list of names. The dashboard's page regenerates these exact
 * steps from the same inputs.
 */
export function farmSteps(
  p: SnapshotProtocol,
  age: number | null,
  implied: number,
  econ: BoardRow['farm_economics'],
  onWatchlist: boolean,
  band: { p10: number; p90: number },
  floorUsd = 50_000_000,
): FarmStep[] {
  const name = p.name;
  const chain = chainOf(p);
  const second = secondChainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasPerTx(chain);
  const weeks = Math.max(1, Math.ceil(hold / 7));
  const action = actionFor(p, capital, chain);
  const risks = riskClauses(p, age, floorUsd);
  const catalysts = catalystClauses(p, age, onWatchlist);
  const verdict = econ.verdict;
  const whyText =
    verdict === 'SKIP'
      ? `Why SKIP: the plan costs ${fmtMoney(econ.net_usd)} net and the point estimate is ${fmtUsd(implied)} (P10 ${fmtUsd(band.p10)} – P90 ${fmtUsd(band.p90)}) — too thin a margin for a token that may never launch. ${risks.length > 0 ? risks.join('; ') + '.' : 'No red flag in the record — the verdict is the thin margin alone.'}`
      : `Why ${verdict}: the plan costs ${fmtMoney(econ.net_usd)} net and the model's point estimate is ${fmtUsd(implied)} (P10 ${fmtUsd(band.p10)} – P90 ${fmtUsd(band.p90)}) — even the low end of the band is far above the cost. The real risk is not the dollars: it is that no token ever launches. ${catalysts.length > 0 ? `Catalyst: ${catalysts.join('; ')}.` : 'No catalyst in the record — the verdict rests on size alone.'}`;
  const riskText = `Risk and exit: ${risks.length > 0 ? risks.join('; ') + '.' : 'no red flag in the record.'} Abandon the plan if TVL falls 30% to ${fmtUsd(Math.round(p.tvl_usd * 0.7))} or the protocol's points page closes; unwind after the hold if no points program is announced.`;
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'no fee to set up',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
  ];
  if (second !== null) {
    const half = Math.max(10, Math.round(capital / 2));
    steps.push({
      text: `${name} also runs on ${second}: repeat the position there with $${half} so the wallet is active on both chains.`,
      cost: `$${half} of capital and about $${gasPerTx(second)} of gas`,
      time: '10 minutes',
    });
  } else {
    steps.push({
      text: secondActionFor(p, capital, chain),
      cost: `about $${gas} of gas`,
      time: '10 minutes',
    });
  }
  steps.push({ text: whyText, cost: 'no fee to read', time: '2 minutes' });
  steps.push(
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: `about $${gas * weeks} of gas over ${weeks} weeks`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
  );
  if (verdict !== 'SKIP') steps.push({ text: riskText, cost: 'no fee to decide', time: '5 minutes' });
  steps.push(
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, then unwind in two steps so the exit is itself recorded.`,
      cost: `about $${gas * 2} of gas to exit`,
      time: '10 minutes',
    },
  );
  return steps;
}

/**
 * The plan netted to the dollar: gas for setup, weekly and exit transactions
 * on the protocol's chains, plus the opportunity cost of the locked capital
 * at 5% a year. The verdict is a rule of thumb, not a promise: FARM when
 * the implied value is large and the net cost is small, THIN when the
 * margin is narrow, SKIP otherwise.
 */
export function farmEconomics(p: SnapshotProtocol, age: number | null, implied: number): BoardRow['farm_economics'] {
  const chain = chainOf(p);
  const second = secondChainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const weeks = Math.max(1, Math.ceil(hold / 7));
  const txs = 1 + 1 + weeks + 2;
  let gas = txs * gasPerTx(chain);
  if (second !== null) gas += gasPerTx(second);
  const opportunity = Math.round(capital * MODEL.apr * (hold / 365) * 100) / 100;
  const net = Math.round((gas + opportunity) * 100) / 100;
  const verdict: 'FARM' | 'THIN' | 'SKIP' =
    implied >= 20_000_000 && net <= 40 ? 'FARM' : implied >= 8_000_000 && net <= 100 ? 'THIN' : 'SKIP';
  return { capital_usd: capital, gas_usd: gas, opportunity_usd: opportunity, net_usd: net, verdict };
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => [
      p.slug,
      p.name,
      p.category,
      p.chains.slice(0, 3).join(', '),
      p.tvl_usd,
      p.mcap_usd,
      p.change_7d === null ? null : Math.round(p.change_7d * 100) / 100,
    ] as LiveRow);
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, onWatchlist: boolean): RadarRow {
  return [
    row.rank,
    row.slug,
    row.name,
    row.category,
    row.chains.slice(0, 3).join(', '),
    row.tvl_usd,
    row.change_7d === null ? null : Math.round(row.change_7d * 100) / 100,
    row.age_days,
    row.implied_value_usd,
    row.implied_value_p10_usd,
    row.implied_value_p90_usd,
    row.rank_p10,
    row.rank_p90,
    onWatchlist ? 1 : 0,
    row.chains.length,
  ];
}

/** The fitted comparables as [log TVL, log mcap] pairs, rounded to 3 decimals. */
export function compsPoints(snapshot: Snapshot): [number, number][] {
  const round3 = (n: number): number => Math.round(n * 1000) / 1000;
  return snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.category !== 'CEX' && p.category !== 'Canonical Bridge')
    .map((p) => [round3(Math.log(p.tvl_usd)), round3(Math.log(p.mcap_usd!))] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const validation = validateModel(snapshot);
  const board = buildBoard(snapshot, model, validation);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    v: MODEL_VERSION,
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    model,
    fit: validation,
    comps: compsPoints(snapshot),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, snapshot.watchlist.includes(r.slug))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!Number.isSafeInteger(r.implied_value_p10_usd) || r.implied_value_p10_usd <= 0) return `${r.slug} has P10 value ${r.implied_value_p10_usd}`;
    if (!Number.isSafeInteger(r.implied_value_p90_usd) || r.implied_value_p90_usd <= 0) return `${r.slug} has P90 value ${r.implied_value_p90_usd}`;
    if (r.rank_p10 < 1 || r.rank_p10 > board.length || r.rank_p90 < 1 || r.rank_p90 > board.length) return `${r.slug} has rank range ${r.rank_p10}-${r.rank_p90}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
