# Airdrop Radar

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/zkNata/airdrop-radar-v2/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard)
[![reward](https://make.fun/badge/token-radar-01/zkNata/airdrop-radar-v2/reward.svg)](https://make.fun/bounty/token-radar-01)

A token launch radar for the [make.fun token-radar-01 bounty](https://make.fun/bounty/token-radar-01): 200 pre-token protocols from a frozen DefiLlama snapshot, ranked by implied launch value, each with a farm plan netted to the dollar — and with the validation shown, failures included.

## What it does

`main.ts` (Node 22, standard library only, no network) reads the sealed snapshot at `/input/snapshot.json`, scores every pre-token protocol with a model fitted on the tokens that already trade, and writes:

- `board.json` — 200 ranked rows (the 40 watchlist protocols at or above $50M TVL, plus 160 early ones below the floor), each with an implied value, a P10–P90 band, a rank range over 200 bootstrap refits, and a farm plan of eight or nine steps.
- `data.js` — the same board as a compact dataset for the dashboard.
- `dashboard/` — a static page: sortable, filterable board, per-protocol detail with the model's own inputs, the fitted size curve, and the validation table.
- `dossier.json` — the summary the judge reads, built with the vendored `vendor/makefun-board.ts`.

## The model (radar-3)

`log(market cap) = 8.0718 + 0.4524 · log(TVL) + 0.003 · growth + log(maturity)`

Fitted on 111 traded comparables (16 dead tokens and 17 CEX/bridge records left out). Growth is the 7-day TVL change in per cent, clamped to −60…+120%; maturity is 0.8 + 0.2 · min(age in days, 1095) / 1095; an unknown listing date counts as 990 days, the median age of the comparables. The shipped constants are the TVL-only OLS fit itself — the program refits them at runtime and reports the refit (intercept 8.0718, elasticity 0.4524), so no stale number can hide.

The formula is unchanged from radar-2 on purpose: every alternative tested on this snapshot failed to beat it on 5-fold out-of-sample R², leave-one-out R² and the 2025 listing cohort together — the free growth+maturity fit (5-fold 0.09), shrunk category offsets (5-fold 0.13, LOO 0.11, 2025 cohort −0.28) and a Huber robust fit (5-fold 0.13, LOO 0.12). Changing the formula to chase a higher in-sample number would be overfitting, so radar-3 keeps the formula and improves everything around it instead.

## How far to trust it — the validation, including the failures

All of these numbers are recomputed from the snapshot by the program itself (folds by sorted-slug index mod 5; cohort splits by listing date; 200-refit bootstrap, fixed seed):

- Shipped model, in-sample R² 0.13; size curve, 5-fold out-of-sample R² 0.13; leave-one-out R² 0.12. House starter: −0.08 on all three.
- Median out-of-sample miss ×3.3. The P10–P90 band on every row comes from the 5-fold out-of-sample residuals (P10 −2.59, P90 +2.08 in log points): a $20M point estimate reads $1.5M–$160M. Farm against the P10, not the point estimate.
- Listing-cohort walk-forward (85 dated comparables): fit before 2023, test 2023+ R² 0.07; before 2024: 0.05; **before 2025: −0.28**. Rolling by listing year: 2023: 0.12, 2024: 0.16, **2025: −0.20**. The 2025 cohort fails: the size curve fitted on older listings does not transfer to the newest listings. The model beats the house starter on every split (starter: −0.24, −0.28, −0.72 on the cuts), but a negative R² is a negative R² — do not read the point estimates as predictions.
- Bootstrap (200 refits): elasticity P10 0.34, P50 0.46, P90 0.57.
- The free fit's loadings are shown on the dashboard: growth −0.02 ± 0.03, log-age −0.36 ± 0.31 — both indistinguishable from zero, which is why they enter as small bounded priors. The maturity prior (coefficient fixed at 1) is a stated choice, not a fitted fact.

A farm plan costs capital by TVL tier ($50–$250), gas by chain, and opportunity cost at 5% a year over the hold. Verdict: **FARM** when implied value is at least $20M and net cost at most $40; **THIN** at $8M and $100; otherwise **SKIP**. FARM and THIN rows also state why (catalyst, band, margin), the risks in the record, and the exit rule — abandon if TVL falls 30% or the points page closes.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Run it twice and the outputs are byte-identical. Then open `out/dashboard/index.html` — it reads `out/data.js` beside it.

## What it is not

Implied value is this entry's own model claim, never make.fun's, and never a prediction that a token will launch. Gas figures are typical, not quotes, and the farm plan never asks you to pay to claim.

## License

MIT — see [LICENSE](LICENSE).
