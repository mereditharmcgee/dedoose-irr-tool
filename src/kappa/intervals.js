// Confidence intervals for kappa.
//
// THE UNIT-OF-ANALYSIS PROBLEM. This tool scores agreement character by
// character. Adjacent characters inside a coded segment are almost perfectly
// correlated, so the character count massively overstates the amount of
// independent information. A naive CI (asymptotic, or a character-level
// bootstrap) therefore reports absurdly tight intervals, including "[1.000,
// 1.000]". That is not a credibility win, it is a credibility loss.
//
// WHAT WE DO INSTEAD: a bootstrap CLUSTERED BY CODING SEGMENT (a block
// bootstrap). We collapse the common window into the maximal runs over which
// no coder's coding changes, treat those runs as the resampling units, and
// resample whole runs with replacement. This respects the within-segment
// dependence and produces honestly wider intervals. It is defensible in a
// methods section as "bootstrap confidence intervals clustered by coding
// segment to account for within-segment dependence."
//
// The gold standard for the reliability of freely unitized continuous text is
// Krippendorff's unitizing alpha (alpha_U). That is a v2 item; see
// docs/roadmap.md.
//
// `cohensKappaCI` (the asymptotic Fleiss-Cohen-Everitt variance) is retained
// only so the test suite can confirm our implementation matches R's
// vcd::Kappa on a classic 2x2. The app does NOT display it, for the reason
// above.

const Z = { 0.9: 1.6448536269514722, 0.95: 1.959963984540054, 0.99: 2.5758293035489004 };

// ---------------------------------------------------------------------------
// Segment-clustered (block) bootstrap CI. This is what the app uses.
//
// perCodeArrays: array over codes; each entry is [coverageArray per coder].
//   For a single-code CI, pass [[coderA, coderB, ...]].
//   For the pooled CI, pass one entry per code (codes concatenated in order).
// kappaOf: (rebuiltArrays) => kappa, where rebuiltArrays is [array per coder].
// ---------------------------------------------------------------------------
export function clusterBootstrapKappaCI(perCodeArrays, kappaOf, { B = 2000, seed = 42, level = 0.95 } = {}) {
  const nCodes = perCodeArrays.length;
  const nRaters = perCodeArrays[0].length;
  const segments = segmentize(perCodeArrays);
  const M = segments.length;
  if (M < 3) return null; // too few independent units to resample meaningfully

  const rand = mulberry32(seed);
  const estimates = [];
  const chosen = new Array(M);

  for (let b = 0; b < B; b++) {
    for (let m = 0; m < M; m++) chosen[m] = segments[(rand() * M) | 0];
    const arrays = rebuild(chosen, nRaters, nCodes);
    const k = kappaOf(arrays);
    if (k !== null && !Number.isNaN(k)) estimates.push(k);
  }

  if (estimates.length < B * 0.5) return null; // mostly degenerate resamples

  estimates.sort((x, y) => x - y);
  const alpha = (1 - level) / 2;
  const lower = clamp(percentile(estimates, alpha));
  const upper = clamp(percentile(estimates, 1 - alpha));

  // A zero-width interval means there is no variation in agreement to resample
  // (perfect agreement / disagreement, or a constant rater). Best practice is
  // to report no interval rather than a fake-precise one.
  if (upper - lower < 1e-9) return null;

  return { method: 'cluster-bootstrap', level, B, seed, segments: M, lower, upper };
}

// Collapse per-code coverage into maximal runs where nothing changes.
function segmentize(perCodeArrays) {
  const nCodes = perCodeArrays.length;
  const nRaters = perCodeArrays[0].length;
  const L = perCodeArrays[0][0].length;

  const segs = [];
  let start = 0;
  for (let i = 1; i <= L; i++) {
    if (i === L || !sameColumn(perCodeArrays, i, start, nCodes, nRaters)) {
      const codes = [];
      for (let c = 0; c < nCodes; c++) {
        const row = new Array(nRaters);
        for (let r = 0; r < nRaters; r++) row[r] = perCodeArrays[c][r][start];
        codes.push(row);
      }
      segs.push({ len: i - start, codes });
      start = i;
    }
  }
  return segs;
}

function sameColumn(perCodeArrays, i, j, nCodes, nRaters) {
  for (let c = 0; c < nCodes; c++) {
    for (let r = 0; r < nRaters; r++) {
      if (!!perCodeArrays[c][r][i] !== !!perCodeArrays[c][r][j]) return false;
    }
  }
  return true;
}

// Rebuild per-coder arrays from a resampled list of segments. Code-major order
// matches how the pooled arrays are concatenated in analyze.js.
function rebuild(chosen, nRaters, nCodes) {
  const out = Array.from({ length: nRaters }, () => []);
  for (let c = 0; c < nCodes; c++) {
    for (const seg of chosen) {
      const len = seg.len;
      const row = seg.codes[c];
      for (let r = 0; r < nRaters; r++) {
        const v = row[r];
        const arr = out[r];
        for (let k = 0; k < len; k++) arr.push(v);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Asymptotic Cohen CI (Fleiss, Cohen & Everitt 1969). Retained for tests only.
// ---------------------------------------------------------------------------
export function cohensKappaCI(a, b, level = 0.95) {
  const n = a.length;
  if (n === 0) return null;

  let n11 = 0, n10 = 0, n01 = 0, n00 = 0;
  for (let i = 0; i < n; i++) {
    const ai = a[i] ? 1 : 0;
    const bi = b[i] ? 1 : 0;
    if (ai && bi) n11++;
    else if (ai && !bi) n10++;
    else if (!ai && bi) n01++;
    else n00++;
  }
  const p11 = n11 / n, p10 = n10 / n, p01 = n01 / n, p00 = n00 / n;
  const pA1 = p11 + p10, pA0 = p01 + p00;
  const pB1 = p11 + p01, pB0 = p10 + p00;

  const po = p11 + p00;
  const pe = pA1 * pB1 + pA0 * pB0;
  if (Math.abs(1 - pe) < 1e-12) return null;
  const kappa = (po - pe) / (1 - pe);

  const k1 = 1 - kappa;
  const A =
    p11 * Math.pow(1 - (pA1 + pB1) * k1, 2) +
    p00 * Math.pow(1 - (pA0 + pB0) * k1, 2);
  const B =
    k1 * k1 * (p10 * Math.pow(pB1 + pA0, 2) + p01 * Math.pow(pB0 + pA1, 2));
  const C = Math.pow(kappa - pe * k1, 2);

  const variance = (A + B - C) / (n * Math.pow(1 - pe, 2));
  const se = Math.sqrt(Math.max(0, variance));
  const z = Z[level] || Z[0.95];

  return { method: 'asymptotic', level, se, lower: clamp(kappa - z * se), upper: clamp(kappa + z * se) };
}

// ---------------------------------------------------------------------------
function percentile(sorted, q) {
  if (sorted.length === 1) return sorted[0];
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function clamp(x) {
  return Math.min(1, Math.max(-1, x));
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
