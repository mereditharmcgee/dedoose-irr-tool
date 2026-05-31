// "Parsing details" panel. Shows exactly what the parser found in each file so
// a user can confirm their Dedoose export was read correctly (and so we can
// validate the parser against a real export). Collapsible; nothing here is
// required to read the results.

export function renderParseDetails(container, coders, analysis) {
  const cards = coders
    .map((coder, i) => {
      const d = coder.diagnostics || {};
      const name = analysis.coderNames[i] || coder.name || `Coder ${i + 1}`;
      const warnings = [];
      if (!d.hasDocument) {
        warnings.push('No document text found, so calibration passages will be unavailable.');
      }
      if (d.codeComments === 0) {
        warnings.push('No Dedoose code comments were found. Is this a coded-document export?');
      }
      if (d.skippedCount > 0) {
        warnings.push(`${d.skippedCount} comment(s) skipped: ${summariseSkips(d.skipped)}.`);
      }
      if (d.codeComments > 0 && d.anchored < d.codeComments) {
        warnings.push(
          `${d.codeComments - d.anchored} of ${d.codeComments} code comments could not be matched to a passage.`
        );
      }

      return `
        <div class="parse-card">
          <h4>${escapeHtml(name)}</h4>
          <dl>
            <div><dt>Comments in file</dt><dd>${d.totalComments ?? '—'}</dd></div>
            <div><dt>Code applications used</dt><dd>${d.codeComments ?? '—'}</dd></div>
            <div><dt>Distinct codes</dt><dd>${coder.codes.length}</dd></div>
            <div><dt>Coded span</dt><dd>${span(coder)}</dd></div>
          </dl>
          ${warnings.length ? `<ul class="parse-warn">${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>` : ''}
        </div>`;
    })
    .join('');

  container.innerHTML = `
    <details class="parse-details">
      <summary>Parsing details — confirm your export read correctly</summary>
      <div class="parse-grid">${cards}</div>
      <p class="parse-common">
        Compared across coders over characters
        <strong>${analysis.commonStart}–${analysis.commonEnd}</strong>
        (${analysis.commonLength.toLocaleString()} characters in common), covering
        ${analysis.codeCount} codes. Kappa uses only this overlapping range.
      </p>
    </details>`;
}

function span(coder) {
  if (coder.spanStart === null || coder.spanEnd === null) return '—';
  return `${coder.spanStart}–${coder.spanEnd}`;
}

function summariseSkips(skipped) {
  const counts = new Map();
  for (const s of skipped) counts.set(s.reason, (counts.get(s.reason) || 0) + 1);
  return [...counts.entries()].map(([reason, n]) => `${n} with ${reason}`).join(', ');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
