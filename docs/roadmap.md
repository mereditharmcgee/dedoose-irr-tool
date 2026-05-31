# Roadmap (v2 backlog)

v1 is deliberately small: Dedoose `.docx` in, Cohen's and Fleiss kappa out, two artifacts, client-side only. Everything below was considered and explicitly left out of v1. Ship v1, see whether anyone uses it, then decide what here is worth building.

## Candidate v2 features

- **More export formats.** NVivo, MAXQDA, or ATLAS.ti coded exports. Each has its own structure; would mean one parser per format behind a shared internal representation.
- **More agreement statistics.** Krippendorff's alpha and Scott's pi. Krippendorff's alpha in particular handles missing data and more than nominal data, and reviewers sometimes ask for it.
- **Krippendorff's unitizing alpha (alpha_U).** This is the methodological gold standard for the reliability of *freely unitized* continuous text, which is exactly what Dedoose coding is: coders choose both the boundaries and the codes of segments on a continuum. The current tool reports character-level kappa (a defensible overlap measure) with a segment-clustered bootstrap CI on the overall value; alpha_U would be the rigorous upgrade. It is a real build and belongs here.
- **Per-code confidence intervals.** Right now the CI is reported only for the overall pooled kappa, because a single transcript rarely has enough independent coding segments to estimate per-code intervals. Multi-transcript analysis (below) is what makes per-code intervals meaningful, so the two go together.
- **More than three coders.** The Fleiss math already generalises; the UI and outputs assume two or three.
- **Multi-document analysis.** Aggregate IRR across several transcripts in one run, not one excerpt at a time.
- **Codebook upload.** Show code definitions alongside results and in the calibration document, so coders calibrate against the written definition.
- **Code grouping / hierarchy.** Treat parent codes and child codes as related rather than flat.
- **Saved sessions.** Optional local project history (still client-side), so a user can reopen a prior analysis. Would need to stay within the no-server, no-account constraint.
- **Per-code threshold in the report.** Currently the only threshold is the calibration-document cutoff.

## Things that should stay out

- Server-side processing of any kind. The privacy guarantee is the point.
- Analytics or telemetry.
- Accounts.

If you pick something up from this list, add a short design note here first describing how it stays within the privacy and scope constraints.
