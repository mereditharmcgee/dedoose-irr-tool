# Dedoose Inter-Rater Reliability Tool

Calculate Cohen's and Fleiss kappa from coded Dedoose `.docx` exports, entirely in your browser. **Your files never leave your machine.** No upload, no server, no accounts, no telemetry.

This exists because demonstrating inter-rater reliability for a Dedoose-coded transcript is harder than it should be. Dedoose's own Training Center assumes an asymmetric trainer-versus-trainee design that does not fit symmetric IRR, and the alternative is hand-structuring your data for R or ReCal. This tool takes the coded exports you already have and gives you the numbers and a calibration worksheet.

## Quick start

1. In Dedoose, export the same coded transcript from each coder as a `.docx` (a coded document export, which carries the code applications as comments).
2. Open the [hosted demo](#hosted-demo) (or run it locally, below).
3. Drag **two or three** `.docx` files onto the drop zone. The number of files sets the number of coders.
4. Read the per-code results inline, then click **Download kappa report (xlsx)** and **Download calibration document (docx)**.

That is the whole flow. Nothing is saved; refresh to start over.

## What you get

- **Inline results**: an overall pooled kappa with its Landis-Koch interpretation and raw agreement, plus a per-code table colour-coded by agreement tier.
- **Kappa report (xlsx)**: a Summary sheet (headline numbers, pairwise Cohen kappa when you have three coders, the Landis-Koch reference table), a Per-code sheet (one row per code, frozen header, colour-coded), and a Methods text sheet with a draft paragraph auto-filled from your numbers for you to edit.
- **Calibration document (docx)**: for every code below your threshold, the passages where some but not all coders applied the code, with space to discuss and recalibrate.

A threshold slider (default 0.40) controls which codes go into the calibration document.

## What's supported in v1

- **Input**: Dedoose `.docx` coded-document exports only.
- **Statistics**: Cohen's kappa (two coders) and Fleiss' kappa (three coders), with Landis-Koch (1977) interpretation.
- **Coders**: two or three at a time, on one transcript at a time.

## What's *not* in v1 (on purpose)

These are intentionally out of scope. See [`docs/roadmap.md`](docs/roadmap.md) for the v2 backlog.

- NVivo, MAXQDA, ATLAS.ti, or any non-Dedoose export
- Krippendorff's alpha or Scott's pi
- Codebook upload or code definitions
- Saved sessions or project history
- More than one transcript at a time
- Accounts or authentication
- Charts or heatmaps beyond the colour-coded table
- Code grouping or hierarchy (codes are treated as flat)

## Privacy

This tool is built for IRB-protected qualitative interview data. Everything — parsing, the kappa math, and generating the xlsx and docx — runs in your browser with no network calls. There is no analytics, no tracking, and no backend. The only thing stored is two UI preferences (your threshold and light/dark choice) in your browser's local storage.

> **Do not commit real interview files.** If you fork this repo, the `.gitignore` already excludes `*.docx`, `*.vtt`, `*.m4a`, and `transcripts/`. The only `.docx` files in the repo are the synthetic fixtures in `test/fixtures/`, which contain invented text. Keep it that way.

## Run locally

```bash
npm install
npm run dev       # Vite dev server (http://localhost:5174)
npm run test      # unit + integration tests (Vitest)
npm run build     # production bundle in dist/
npm run preview   # preview the production build
npm run fixtures  # regenerate the synthetic test fixtures
```

## How the math is validated

The kappa math is checked two ways:

1. **Unit and integration tests** (`npm run test`) assert known inputs against hand-computed values, including a textbook Cohen's kappa of 0.40, a hand-worked Fleiss case, and the full pipeline on the fixtures (perfect, negative, null, and zero-variance codes).
2. **Independent check against R's `irr` package.** The scripts in [`docs/validation/`](docs/validation/) export the exact coverage matrices the tool builds and recompute kappa in R, so you can confirm the numbers match independently:

   ```bash
   node docs/validation/export_for_r.mjs
   Rscript docs/validation/validate.R   # requires install.packages("irr")
   ```

For how the Dedoose format is parsed and one place the handoff spec was ambiguous, see [`docs/dedoose_format.md`](docs/dedoose_format.md).

## Hosted demo

**Live: [meredithmcgee.org/tools/kappa](https://meredithmcgee.org/tools/kappa/)**

That instance is a static build of this tool dropped into the `public/` folder of the meredithmcgee.org Astro site. To rebuild and redeploy it there, run `VITE_BASE=/tools/kappa/ npm run build` and copy `dist/` into the site's `public/tools/kappa/`.

To instead host this repo on its own GitHub Pages site, activate the deploy workflow: move [`docs/github-pages-deploy.yml.example`](docs/github-pages-deploy.yml.example) to `.github/workflows/deploy.yml`, then in the repo's Settings enable Pages with "GitHub Actions" as the source. It builds and publishes `dist/` on every push to `main` (the default relative base works at the site root, so no `VITE_BASE` override is needed). The workflow ships as a template rather than active because adding a workflow file requires a token with `workflow` scope; the GitHub web editor handles this automatically when you add the file there.

## How to cite

If you use this tool in published work, cite it with a version and (once set up) a Zenodo DOI:

> McGee, M. (2026). *Dedoose Inter-Rater Reliability Tool* (v1.0.0) [Software]. https://github.com/<your-org>/<your-repo>

Minting a DOI is a few clicks: connect the GitHub repo to [Zenodo](https://zenodo.org), then cut a release. Zenodo archives the release and issues a citable DOI. Add it here when you have it.

## Contributing

Issues and pull requests are welcome. Please keep v1 scope-disciplined: if a change adds one of the explicitly out-of-scope features above, open an issue to discuss it as a v2 item first. Run `npm run test` before opening a PR, and never include real participant data in a fixture or test.

## License

MIT. See [`LICENSE`](LICENSE).
