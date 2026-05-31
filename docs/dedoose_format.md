# The Dedoose `.docx` export format (internal notes)

A Dedoose coded-document export is a `.docx`, which is a zip archive of XML. The parser ([`src/parsers/dedoose.js`](../src/parsers/dedoose.js)) reads two entries.

## `word/comments.xml` — the code applications

Each code application is a Word comment. Its first paragraph is a range header, and every paragraph after it is one code name:

```xml
<w:comment w:id="0">
  <w:p><w:r><w:t>Codes (485-522)</w:t></w:r></w:p>
  <w:p><w:r><w:t>Overall impressions about policy in their state</w:t></w:r></w:p>
  <w:p><w:r><w:t>Personal opinions - changed since legalization</w:t></w:r></w:p>
</w:comment>
```

Parser rules:

1. The first paragraph must match `/Codes\s*\(\s*(\d+)\s*-\s*(\d+)\s*\)/`. The two integers are Dedoose's own character offsets into the transcript (not Word offsets). We capture them as `start` and `end`.
2. Each later paragraph is one code name, trimmed. A single comment can carry several codes.
3. Comments whose first paragraph does not match the `Codes(...)` pattern are non-Dedoose comments (reviewer notes, etc.) and are skipped.

Paragraph text is the concatenation of every `<w:t>` descendant of the `<w:p>`.

## `word/document.xml` — the transcript body

Used only to recover the passage text behind each comment for the calibration document. We walk the body's `<w:p>` elements in order; any paragraph containing a `<w:commentReference w:id="N">` is recorded as the anchor for comment `N`, along with that paragraph's concatenated text and its index. The paragraph index is what the calibration document labels as "Para N".

## Coverage construction (and a spec ambiguity worth knowing)

Kappa here is computed at the **character level**. For each code, each coder gets a boolean array over a shared character window; position `i` is `true` if that coder applied the code to that character.

**The common window.** The handoff spec said, for step 1, "for each coder, find the common range: `max(starts)` to `min(ends)` across all their comments." Taken literally, that is the *intersection of every one of a coder's comment intervals*. For real coding, where a coder's comments are scattered across the transcript, that intersection is empty or vanishingly small, and there would be nothing to compare. Step 2 of the spec ("common range across coders is `max(individual_starts)` to `min(individual_ends)`") only makes sense for inter-rater reliability if each coder's `individual_start` is their *earliest* coded position and `individual_end` their *latest* — that is, the coder's coded **span**, with the common window being the **overlap of spans**.

So this tool implements:

- **Per coder span**: `[min(starts), max(ends)]` — the full extent the coder coded.
- **Common window**: `[max(span starts), min(span ends)]` — the overlap across coders.

This is the standard way to bound a comparable region in IRR: compare coders only over the stretch of transcript that all of them actually examined. We treat the per-coder "max(starts) to min(ends)" wording in the handoff as a typo, because the intersection reading collapses the window.

If a future Dedoose export genuinely warrants the literal intersection reading (for example, if exports always include one enveloping comment that defines the analysable span), this is the single place to change it: `buildCoverageMatrices` in [`src/kappa/analyze.js`](../src/kappa/analyze.js).

**Marking.** For a comment carrying a code, we set characters `[comment.start - commonStart, comment.end - commonStart)` to `true` (half-open, clamped to the window). The window length is `commonEnd - commonStart`.

**Pooled kappa.** Concatenate every code's per-coder arrays into one long pair (or triple) of arrays and compute a single kappa. This is the "overall" number in the summary.

## Disagreement passages (calibration document)

These are computed at the **paragraph** level, not the character level. For a given code, we collect, per coder, the set of anchor paragraphs they tagged with that code. For each paragraph in the union, if some but not all coders tagged it, that paragraph is a disagreement passage, labelled with who applied the code (green) and who did not (red).

Character-level kappa and paragraph-level disagreement passages can therefore tell slightly different stories: a code can have a low kappa from differing character ranges even while both coders anchored it to the same paragraphs (in which case the calibration document notes there are no paragraph-level disagreements to review).

## Confidence intervals (and the unit-of-analysis trap)

Scoring agreement character by character creates a statistical trap for confidence intervals. Adjacent characters inside a coded segment are almost perfectly correlated, so the character count massively overstates the amount of independent information. A naive CI (an asymptotic formula, or a character-level bootstrap) therefore reports absurdly tight intervals on the order of plus or minus a few hundredths, including the nonsensical `[1.000, 1.000]` for a perfectly agreed code. That is consistent with what R would produce on the same character vectors, but it is not honest: the model assumption (independent observations) is wrong.

This tool instead reports a **bootstrap clustered by coding segment** (a block bootstrap), and only for the **overall pooled kappa**:

- The common window is collapsed into the maximal runs over which no coder's coding changes (`segmentize` in [`src/kappa/intervals.js`](../src/kappa/intervals.js)). These segments are the natural decision units.
- The bootstrap resamples whole segments with replacement, recomputes kappa, and takes the percentile interval. This respects within-segment dependence and produces honestly wider intervals. It is defensible in a methods section as "bootstrap confidence intervals clustered by coding segment to account for within-segment dependence." A fixed seed makes the interval reproducible.
- **Per-code CIs are not reported.** A single transcript rarely contains enough independent coding segments to estimate them; a four-segment code yields an interval near the full `[-1, 1]` range, which is just noise. Per-code intervals are properly a multi-transcript analysis.
- Codes (or a pooled estimate) with no variation in agreement have no interval to estimate and report nothing.

The retained asymptotic `cohensKappaCI` (Fleiss, Cohen & Everitt 1969) exists only so the test suite can confirm the variance formula matches R's `vcd::Kappa` on a classic 2x2; the app does not display it.

The genuinely rigorous answer for the reliability of freely unitized continuous text is Krippendorff's unitizing alpha (alpha_U), which is on the roadmap.
