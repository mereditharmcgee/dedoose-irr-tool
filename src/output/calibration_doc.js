// Generate the calibration (disagreement passages) .docx with the `docx`
// package.
//
// Design note (revised after validating against real exports): the document is
// organised around the actual DISAGREEMENT PASSAGES, not a kappa threshold. On
// real high-agreement coding, the low-kappa codes are usually boundary/extent
// differences with no passage-level disagreement at all, while the passages
// worth discussing (one coder applied a code, another did not) sit in codes
// with high overall kappa. Filtering by kappa therefore hides exactly the
// content a calibration session needs.
//
// Section 1: every code that has at least one disagreement passage, lowest
//   agreement first. This is threshold-independent.
// Section 2: codes below the user's threshold that have NO passage-level
//   disagreement, listed as a prompt to compare highlighting habits. The
//   threshold governs only this section.

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { formatKappa } from './format.js';

const GREEN = '2E7D32';
const RED = 'C62828';
const INDENT = { left: 720 }; // 0.5 inch in twips

// Codes below the kappa threshold (kept for the second section and for callers
// that still want this view).
export function codesBelowThreshold(analysis, threshold) {
  return analysis.codes.filter((c) => c.result.kappa !== null && c.result.kappa < threshold);
}

function kappaSortKey(code) {
  return code.result.kappa === null ? Infinity : code.result.kappa;
}

export function buildCalibrationDocument(analysis, threshold) {
  const children = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun('Coder Calibration: Disagreement Passages')],
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun(
          `Coders: ${analysis.coderNames.join(', ')}. The first section lists every passage where ` +
            `at least one coder applied a code and at least one did not, sorted from lowest agreement. ` +
            `These are the concrete disagreements to talk through. Any codes with lower overall ` +
            `agreement but no passage-level disagreement are listed at the end as a prompt to compare ` +
            `how much text each of you highlights.`
        ),
      ],
    })
  );

  const withDisagreements = analysis.codes
    .filter((c) => c.disagreements.length > 0)
    .sort((a, b) => kappaSortKey(a) - kappaSortKey(b));

  const lowNoPassages = analysis.codes
    .filter((c) => c.result.kappa !== null && c.result.kappa < threshold && c.disagreements.length === 0)
    .sort((a, b) => a.result.kappa - b.result.kappa);

  // --- Section 1: the actual disagreements ---
  children.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Passages to review together')] })
  );

  if (withDisagreements.length === 0) {
    children.push(
      italicPara(
        'No passages where some coders applied a code and others did not. On this material your ' +
          'coders agreed on which passages get which codes; any differences are in the exact extent ' +
          'of highlighting, covered below.'
      )
    );
  } else {
    children.push(
      italicPara('Decide together whether the code applies, and note the rule you agree on for next time.')
    );
    withDisagreements.forEach((code, idx) => {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          pageBreakBefore: idx > 0,
          children: [new TextRun(code.name)],
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Kappa: ${formatKappa(code.result.kappa)} (${code.interpretation.label}) | Disagreement passages: ${code.disagreements.length}`,
              bold: true,
            }),
          ],
        })
      );
      for (const passage of code.disagreements) {
        children.push(buildPassageHeader(passage));
        children.push(
          new Paragraph({
            indent: INDENT,
            children: [new TextRun({ text: passage.text || '(passage text unavailable)', italics: true })],
          })
        );
        children.push(
          new Paragraph({
            indent: INDENT,
            spacing: { after: 240 },
            children: [new TextRun({ text: 'Discussion: ', bold: true })],
          })
        );
      }
    });
  }

  // --- Section 2: low agreement without passage-level disagreement ---
  if (lowNoPassages.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        children: [new TextRun('Lower agreement, but no specific passages')],
      })
    );
    children.push(
      italicPara(
        `These codes scored below ${threshold.toFixed(2)} yet you applied them to the same passages, ` +
          `so the disagreement is in how much text each of you highlighted, not whether the code ` +
          `applies. Worth comparing your highlighting habits on these.`
      )
    );
    for (const code of lowNoPassages) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: code.name, bold: true }),
            new TextRun({
              text: `: kappa ${formatKappa(code.result.kappa)} (${code.interpretation.label})`,
            }),
          ],
        })
      );
    }
  }

  return new Document({
    creator: 'Dedoose IRR Tool',
    title: 'Coder Calibration',
    sections: [{ children }],
  });
}

function italicPara(text) {
  return new Paragraph({ children: [new TextRun({ text, italics: true })] });
}

function buildPassageHeader(passage) {
  const runs = [
    new TextRun({ text: `Para ${passage.paraIndex}   `, bold: true }),
    new TextRun({ text: 'Applied by: ', bold: true }),
    new TextRun({ text: passage.appliedBy.join(', ') || 'none', bold: true, color: GREEN }),
    new TextRun({ text: '   Not applied by: ', bold: true }),
    new TextRun({ text: passage.notAppliedBy.join(', ') || 'none', bold: true, color: RED }),
  ];
  return new Paragraph({ spacing: { before: 160 }, children: runs });
}

export async function buildCalibrationDocBlob(analysis, threshold) {
  const doc = buildCalibrationDocument(analysis, threshold);
  return Packer.toBlob(doc);
}
