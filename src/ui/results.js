// Per-code results table, colour-coded by Landis-Koch tier. Rows whose kappa is
// below the current calibration threshold are flagged so the user can see what
// the calibration document will contain.

import { formatKappa, formatPercent, tierClass } from '../output/format.js';

export function renderResultsTable(container, analysis, threshold) {
  const rateHeaders = analysis.coderNames
    .map((name) => `<th class="num">${escapeHtml(name)} %</th>`)
    .join('');

  const rows = analysis.codes
    .map((code) => {
      const r = code.result;
      const tier = tierClass(code.interpretation.tier);
      const below = r.kappa !== null && r.kappa < threshold;
      const rateCells = r.rates
        .map((rate) => `<td class="num">${formatPercent(rate)}</td>`)
        .join('');
      return `
        <tr class="${below ? 'below-threshold' : ''}">
          <td class="code-name">${escapeHtml(code.name)}</td>
          ${rateCells}
          <td class="num cell-kappa ${tier}">${formatKappa(r.kappa)}</td>
          <td class="cell-interp ${tier}">${code.interpretation.label}</td>
          <td class="num">${formatPercent(r.rawAgreement)}</td>
          <td class="num">${r.bothApplied.toLocaleString()}</td>
          <td class="num">${r.eitherApplied.toLocaleString()}</td>
        </tr>`;
    })
    .join('');

  container.innerHTML = `
    <table class="code-table">
      <thead>
        <tr>
          <th>Code</th>
          ${rateHeaders}
          <th class="num">Kappa</th>
          <th>Interpretation</th>
          <th class="num">Raw agree</th>
          <th class="num">Chars all</th>
          <th class="num">Chars any</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
