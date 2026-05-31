// Headline (pooled kappa) and bottom summary statistics.

import { formatKappa, formatPercent, formatCI, formatAlphaU, tierClass } from '../output/format.js';

export function renderHeadline(container, analysis) {
  const { result, interpretation, ci, alphaU } = analysis.pooled;
  const methodLabel = analysis.method === 'cohen' ? "Cohen's kappa" : "Fleiss' kappa";
  const ciLine = ci
    ? `<span class="muted">95% CI ${formatCI(ci)}</span>`
    : '';
  const alphaLine =
    alphaU !== null && alphaU !== undefined
      ? `<span class="muted">Unitizing &alpha;<sub>U</sub> ${formatAlphaU(alphaU)}</span>`
      : '';

  container.className = 'headline';
  container.innerHTML = `
    <div class="kappa-big">${formatKappa(result.kappa)}</div>
    <div class="headline-meta">
      <span class="interp-pill ${tierClass(interpretation.tier)}">${interpretation.label}</span>
      <span class="muted">Overall pooled ${methodLabel} across ${analysis.codeCount} codes</span>
      <span class="muted">${formatPercent(result.rawAgreement)} raw agreement &middot; ${analysis.nRaters} coders</span>
      ${ciLine}
      ${alphaLine}
    </div>
  `;
}

export function renderStats(container, analysis) {
  const cards = [
    { value: analysis.codeCount, label: 'codes evaluated' },
    { value: analysis.commonLength.toLocaleString(), label: 'characters in common range' },
    ...analysis.coderNames.map((name, i) => ({
      value: analysis.commentCounts[i],
      label: `comments — ${name}`,
    })),
  ];

  container.className = 'stats';
  container.innerHTML = cards
    .map(
      (c) => `
      <div class="stat-card">
        <div class="stat-value">${c.value}</div>
        <div class="stat-label">${escapeHtml(c.label)}</div>
      </div>`
    )
    .join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
