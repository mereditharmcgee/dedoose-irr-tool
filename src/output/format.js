// Shared formatting helpers used by the UI and both output generators.

export function formatKappa(kappa) {
  if (kappa === null || kappa === undefined || Number.isNaN(kappa)) return '—';
  return kappa.toFixed(3);
}

export function formatPercent(fraction, digits = 1) {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
}

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
