# Validating the kappa math against R's `irr`

These scripts confirm the tool's kappa numbers independently, by recomputing them in R on the **exact same** character-level coverage matrices the JavaScript builds.

## Steps

From the repo root:

```bash
# 1. Export the coverage matrices and the tool's own kappa values.
node docs/validation/export_for_r.mjs

# 2. Recompute in R and print a side-by-side comparison.
Rscript docs/validation/validate.R
```

Step 1 writes three CSVs into this folder (they are git-ignored, since they are derived artifacts):

- `coverage_ab.csv` — one row per character for coders A and B (`0`/`1` per coder)
- `coverage_abc.csv` — same for the three-coder set
- `expected.csv` — this tool's kappa for each code, and the pooled value

Step 2 needs the `irr` package:

```r
install.packages("irr")
```

## What to look for

For the two-coder table, the `abs diff` column compares this tool's kappa to `irr::kappa2`. It should be ~0 everywhere (well under `1e-9`). Codes with no variance (for example *Market saturation*, which both coders applied across the whole window) are undefined in both implementations and are reported as such.

The three-coder table prints `irr::kappam.fleiss` for each code; compare it against the Fleiss values the tool shows when you load all three fixtures.

## Why this is trustworthy

The CSVs come straight from `buildCoverageMatrices` in `src/kappa/analyze.js`, the same function the app uses to feed its own kappa functions. R and the tool therefore operate on identical input, so any difference would be a genuine math discrepancy rather than a data-shaping artifact.
