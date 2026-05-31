// Shared formatting helpers used by the UI and both output generators.

export function formatKappa(kappa) {
  if (kappa === null || kappa === undefined || Number.isNaN(kappa)) return '—';
  return kappa.toFixed(3);
}

export function formatPercent(fraction, digits = 1) {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatCI(ci) {
  if (!ci) return '—';
  return `[${ci.lower.toFixed(3)}, ${ci.upper.toFixed(3)}]`;
}

// Short label for how a CI was computed, for tooltips / report footnotes.
export function ciMethodLabel(ci) {
  if (!ci) return '';
  if (ci.method === 'cluster-bootstrap') {
    return `bootstrap clustered by coding segment, ${ci.B} resamples`;
  }
  if (ci.method === 'bootstrap') return `bootstrap, ${ci.B} resamples`;
  return 'asymptotic (Fleiss-Cohen-Everitt)';
}

// The methods note, reused in the UI, the xlsx, and the methods text.
export const CI_CAVEAT =
  'The 95% confidence interval on the overall pooled kappa uses a bootstrap ' +
  'clustered by coding segment, which accounts for the fact that agreement is ' +
  'scored character by character and adjacent characters are correlated. ' +
  'Per-code kappas are reported as point estimates: a single transcript ' +
  'rarely contains enough independent coding segments to estimate per-code ' +
  'intervals, which is properly a multi-transcript analysis. For the ' +
  'reliability of freely unitized text, Krippendorff’s unitizing alpha is the ' +
  'gold standard. Both are planned for a future version.';

// Excel-style ARGB fills + font colours per interpretation tier.
export const TIER_STYLE = {
  green: { fill: 'FFC6EFCE', font: 'FF006100' },
  yellow: { fill: 'FFFFEB9C', font: 'FF9C5700' },
  red: { fill: 'FFFFC7CE', font: 'FF9C0006' },
  none: { fill: 'FFF2F2F2', font: 'FF7F7F7F' },
};

// CSS class suffix for the same tiers (used by the results table).
export function tierClass(tier) {
  return `tier-${tier}`;
}
