// Orchestration layer: turn parsed Dedoose coders into the full analysis the
// UI and the output generators consume.
//
// Coverage construction (per docs/dedoose_format.md):
//   * Each coder has a coded span [spanStart, spanEnd] = earliest start to
//     latest end across their comments.
//   * The common window is the overlap of spans:
//       commonStart = max(spanStart over coders)
//       commonEnd   = min(spanEnd   over coders)
//   * For each code, each coder gets a boolean array of length
//     (commonEnd - commonStart). A comment carrying that code marks
//     [comment.start - commonStart, comment.end - commonStart) true (clamped).

import { cohensKappa } from './cohens.js';
import { fleissKappa } from './fleiss.js';
import { interpretKappa } from './interpret.js';

// Build the character-level boolean coverage matrices shared by analyze() and
// the R validation exporter. Exposed so both compute kappa on identical input.
export function buildCoverageMatrices(coders) {
  if (coders.length < 2) {
    throw new Error('Need at least two coders to compute inter-rater reliability.');
  }
  if (coders.length > 3) {
    // v1 scope: two or three coders.
    throw new Error('This tool supports two or three coders in v1.');
  }

  const coderNames = coders.map((c, i) => c.name || `Coder ${String.fromCharCode(65 + i)}`);
  const commonStart = Math.max(...coders.map((c) => c.spanStart));
  const commonEnd = Math.min(...coders.map((c) => c.spanEnd));
  const commonLength = Math.max(0, commonEnd - commonStart);

  if (commonLength === 0) {
    throw new Error(
      'The coders have no overlapping coded range. Are these exports of the same transcript?'
    );
  }

  const codeNames = [...new Set(coders.flatMap((c) => c.codes))].sort();

  const coverageByCode = new Map();
  for (const code of codeNames) {
    coverageByCode.set(
      code,
      coders.map((coder) => buildCoverage(coder, code, commonStart, commonLength))
    );
  }

  return { coderNames, commonStart, commonEnd, commonLength, codeNames, coverageByCode };
}

export function analyze(coders) {
  const { coderNames, commonStart, commonEnd, commonLength, codeNames, coverageByCode } =
    buildCoverageMatrices(coders);
  const nRaters = coders.length;

  // Per-code kappa.
  const codes = codeNames.map((code) => {
    const arrays = coverageByCode.get(code);
    const result = nRaters === 2 ? cohensKappa(arrays[0], arrays[1]) : fleissKappa(arrays);
    return {
      name: code,
      result,
      interpretation: interpretKappa(result.kappa),
      disagreements: disagreementPassages(coders, code, coderNames),
    };
  });

  // Pooled kappa: concatenate every code's arrays per coder, then one kappa.
  const pooledArrays = coders.map(() => []);
  for (const code of codeNames) {
    const arrays = coverageByCode.get(code);
    for (let r = 0; r < nRaters; r++) pooledArrays[r].push(...arrays[r]);
  }
  const pooledResult =
    nRaters === 2 ? cohensKappa(pooledArrays[0], pooledArrays[1]) : fleissKappa(pooledArrays);
  const pooled = { result: pooledResult, interpretation: interpretKappa(pooledResult.kappa) };

  // Pairwise Cohen's kappa (only meaningful / reported with 3+ coders).
  let pairwise = [];
  if (nRaters >= 3) {
    for (let i = 0; i < nRaters; i++) {
      for (let j = i + 1; j < nRaters; j++) {
        const a = [];
        const b = [];
        for (const code of codeNames) {
          const arrays = coverageByCode.get(code);
          a.push(...arrays[i]);
          b.push(...arrays[j]);
        }
        const result = cohensKappa(a, b);
        pairwise.push({
          pair: [i, j],
          names: [coderNames[i], coderNames[j]],
          result,
          interpretation: interpretKappa(result.kappa),
        });
      }
    }
  }

  return {
    coderNames,
    nRaters,
    method: nRaters === 2 ? 'cohen' : 'fleiss',
    commonStart,
    commonEnd,
    commonLength,
    commentCounts: coders.map((c) => c.comments.length),
    codeCount: codeNames.length,
    codes,
    pooled,
    pairwise,
  };
}

// Build a coder's boolean coverage array for one code over the common window.
function buildCoverage(coder, code, commonStart, commonLength) {
  const arr = new Array(commonLength).fill(false);
  for (const comment of coder.comments) {
    if (!comment.codes.includes(code)) continue;
    let s = comment.start - commonStart;
    let e = comment.end - commonStart;
    if (s < 0) s = 0;
    if (e > commonLength) e = commonLength;
    for (let i = s; i < e; i++) arr[i] = true;
  }
  return arr;
}

// For one code, find paragraphs where SOME but not ALL coders applied it.
// Paragraph identity comes from each comment's anchor (commentReference index).
function disagreementPassages(coders, code, coderNames) {
  const nRaters = coders.length;

  // coder index -> Map(paraIndex -> text) for paragraphs they tagged with `code`
  const perCoder = coders.map((coder) => {
    const m = new Map();
    for (const comment of coder.comments) {
      if (!comment.codes.includes(code)) continue;
      const anchor = coder.commentParagraphs[comment.id];
      if (!anchor) continue;
      if (!m.has(anchor.paraIndex)) m.set(anchor.paraIndex, anchor.text);
    }
    return m;
  });

  // Union of paragraph indices touched by this code.
  const allParas = new Set();
  for (const m of perCoder) for (const idx of m.keys()) allParas.add(idx);

  const passages = [];
  for (const idx of [...allParas].sort((a, b) => a - b)) {
    const appliedBy = [];
    const notAppliedBy = [];
    let text = '';
    for (let r = 0; r < nRaters; r++) {
      if (perCoder[r].has(idx)) {
        appliedBy.push(coderNames[r]);
        if (!text) text = perCoder[r].get(idx);
      } else {
        notAppliedBy.push(coderNames[r]);
      }
    }
    if (appliedBy.length > 0 && appliedBy.length < nRaters) {
      passages.push({ paraIndex: idx, text, appliedBy, notAppliedBy });
    }
  }
  return passages;
}
