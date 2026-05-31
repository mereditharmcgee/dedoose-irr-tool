// Generate the three-sheet xlsx kappa report with ExcelJS.
//   1. Summary       headline numbers, pairwise table, Landis-Koch reference
//   2. Per-code kappa one row per code, colour-coded by tier, frozen header
//   3. Methods text  an auto-filled draft paragraph the user edits

import ExcelJS from 'exceljs';
import { LANDIS_KOCH_TABLE } from '../kappa/interpret.js';
import { formatKappa, formatPercent, formatCI, formatAlphaU, ciMethodLabel, CI_CAVEAT, ALPHA_U_NOTE, TIER_STYLE } from './format.js';

export async function buildKappaReport(analysis) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dedoose IRR Tool';
  wb.created = new Date(0); // deterministic; avoids leaking a real timestamp

  buildSummarySheet(wb, analysis);
  buildPerCodeSheet(wb, analysis);
  buildMethodsSheet(wb, analysis);

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function tierFill(tier) {
  const style = TIER_STYLE[tier] || TIER_STYLE.none;
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } };
}

function tierFont(tier) {
  const style = TIER_STYLE[tier] || TIER_STYLE.none;
  return { color: { argb: style.font } };
}

function buildSummarySheet(wb, a) {
  const ws = wb.addWorksheet('Summary');
  ws.columns = [{ width: 32 }, { width: 22 }, { width: 22 }, { width: 22 }];

  const title = ws.addRow(['Inter-Rater Reliability Report']);
  title.font = { size: 16, bold: true };
  ws.addRow([]);

  ws.addRow(['Coders', a.coderNames.join(', ')]);
  ws.addRow(['Method', a.method === 'cohen' ? "Cohen's kappa (2 raters)" : "Fleiss' kappa (3+ raters)"]);
  ws.addRow(['Common range (characters)', a.commonLength]);
  ws.addRow(['Codes evaluated', a.codeCount]);
  a.coderNames.forEach((name, i) => {
    ws.addRow([`Comments by ${name}`, a.commentCounts[i]]);
  });
  ws.addRow([]);

  const pooledRow = ws.addRow([
    'Overall pooled kappa',
    formatKappa(a.pooled.result.kappa),
    a.pooled.interpretation.label,
  ]);
  pooledRow.font = { bold: true };
  pooledRow.getCell(2).fill = tierFill(a.pooled.interpretation.tier);
  pooledRow.getCell(2).font = { bold: true, ...tierFont(a.pooled.interpretation.tier) };
  pooledRow.getCell(3).fill = tierFill(a.pooled.interpretation.tier);
  ws.addRow(['Raw agreement', formatPercent(a.pooled.result.rawAgreement)]);
  if (a.pooled.ci) {
    ws.addRow(['Pooled 95% CI', formatCI(a.pooled.ci), `(${ciMethodLabel(a.pooled.ci)})`]);
  }
  if (a.pooled.alphaU !== null && a.pooled.alphaU !== undefined) {
    ws.addRow(['Overall unitizing alpha (alpha_U)', formatAlphaU(a.pooled.alphaU)]);
  }
  ws.addRow([]);

  if (a.pairwise.length > 0) {
    const h = ws.addRow(['Pairwise Cohen kappa', 'Kappa', '95% CI', 'Interpretation']);
    h.font = { bold: true };
    for (const p of a.pairwise) {
      const row = ws.addRow([
        `${p.names[0]} vs ${p.names[1]}`,
        formatKappa(p.result.kappa),
        formatCI(p.ci),
        p.interpretation.label,
      ]);
      row.getCell(2).fill = tierFill(p.interpretation.tier);
      row.getCell(2).font = tierFont(p.interpretation.tier);
    }
    ws.addRow([]);
  }

  const lkHeader = ws.addRow(['Landis-Koch (1977) reference', 'Range', 'Agreement']);
  lkHeader.font = { bold: true };
  for (const r of LANDIS_KOCH_TABLE) {
    ws.addRow(['', r.range, r.label]);
  }
  ws.addRow([]);

  const note = ws.addRow([
    'Methods note: Kappa was computed at the character level over the range coded by all raters. ' +
      'A pooled kappa concatenates every code into one comparison. ' +
      CI_CAVEAT +
      ' See the "Methods text" sheet for a draft you can edit.',
  ]);
  note.font = { italic: true };
  ws.mergeCells(`A${note.number}:D${note.number}`);
  note.getCell(1).alignment = { wrapText: true, vertical: 'top' };
}

function buildPerCodeSheet(wb, a) {
  const ws = wb.addWorksheet('Per-code kappa');

  const rateCols = a.coderNames.map((name) => `${name} applied %`);
  const header = [
    'Code',
    ...rateCols,
    'Kappa',
    'alpha_U',
    'Interpretation',
    'Raw agreement',
    'Chars all applied',
    'Chars any applied',
  ];
  const headerRow = ws.addRow(header);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F4F4F' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });

  ws.columns.forEach((col, i) => {
    col.width = i === 0 ? 34 : 18;
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const code of a.codes) {
    const r = code.result;
    const row = ws.addRow([
      code.name,
      ...r.rates.map((rate) => formatPercent(rate)),
      formatKappa(r.kappa),
      formatAlphaU(code.alphaU),
      code.interpretation.label,
      formatPercent(r.rawAgreement),
      r.bothApplied,
      r.eitherApplied,
    ]);
    const kappaCol = 1 + rateCols.length + 1; // 1-based: Code + rates + Kappa
    const interpCol = kappaCol + 2; // Kappa, alpha_U, then Interpretation
    row.getCell(kappaCol).fill = tierFill(code.interpretation.tier);
    row.getCell(kappaCol).font = tierFont(code.interpretation.tier);
    row.getCell(interpCol).fill = tierFill(code.interpretation.tier);
    row.getCell(interpCol).font = tierFont(code.interpretation.tier);
  }
}

function buildMethodsSheet(wb, a) {
  const ws = wb.addWorksheet('Methods text');
  ws.columns = [{ width: 110 }];

  const heading = ws.addRow(['Draft methods paragraph']);
  heading.font = { size: 14, bold: true };
  ws.addRow([]);

  const para = ws.addRow([methodsParagraph(a)]);
  para.getCell(1).alignment = { wrapText: true, vertical: 'top' };
  ws.getRow(para.number).height = 120;
  ws.addRow([]);

  const note = ws.addRow([
    'NOTE: These sentences are auto-filled from your current analysis. Edit them into your own ' +
      'voice and verify every number against the report before you publish. This tool does not ' +
      'write your methods section for you.',
  ]);
  note.font = { italic: true, color: { argb: 'FF9C0006' } };
  note.getCell(1).alignment = { wrapText: true, vertical: 'top' };
}

export function methodsParagraph(a) {
  const method = a.method === 'cohen' ? "Cohen's kappa" : "Fleiss' kappa";
  const pooledK = formatKappa(a.pooled.result.kappa);
  const interp = a.pooled.interpretation.label.toLowerCase();
  const agree = formatPercent(a.pooled.result.rawAgreement);

  const ciClause = a.pooled.ci ? `, 95% CI ${formatCI(a.pooled.ci)}` : '';

  let text =
    `A single transcript was independently coded by ${a.nRaters} coders ` +
    `(${a.coderNames.join(', ')}). Inter-rater reliability was assessed at the character level ` +
    `across the ${a.commonLength.toLocaleString()}-character range coded by all raters, covering ` +
    `${a.codeCount} codes. ${method} was computed for each code and pooled across all codes by ` +
    `concatenating the per-code agreement vectors. The pooled kappa was ${pooledK}${ciClause} ` +
    `(${interp} agreement, Landis and Koch 1977), with ${agree} raw agreement.`;

  if (a.pairwise.length > 0) {
    const parts = a.pairwise.map(
      (p) => `${p.names[0]} and ${p.names[1]} (kappa = ${formatKappa(p.result.kappa)})`
    );
    text += ` Pairwise agreement between coders was ${parts.join(', ')}.`;
  }

  if (a.pooled.ci) {
    text +=
      ` Confidence intervals were estimated using the ${ciMethodLabel(a.pooled.ci)} method. ` +
      'Because agreement was scored at the character level, adjacent positions are correlated, ' +
      'so these intervals are best read as a lower bound on uncertainty.';
  }

  if (a.pooled.alphaU !== null && a.pooled.alphaU !== undefined) {
    text +=
      ` Krippendorff's unitizing alpha, which is designed for freely segmented text, was ` +
      `${formatAlphaU(a.pooled.alphaU)} overall.`;
  }

  return text;
}
