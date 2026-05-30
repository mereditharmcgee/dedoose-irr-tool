// Generate the calibration (disagreement passages) .docx with the `docx`
// package. For every code whose kappa falls below the user's threshold, list
// the passages where some but not all coders applied the code, with space for
// the team to discuss and recalibrate.

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import { formatKappa } from './format.js';

const GREEN = '2E7D32';
const RED = 'C62828';
const INDENT = { left: 720 }; // 0.5 inch in twips

// Pick the codes that belong in the calibration document.
export function codesBelowThreshold(analysis, threshold) {
  return analysis.codes.filter(
    (c) => c.result.kappa !== null && c.result.kappa < threshold
  );
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
          `This document lists every code with a kappa below ${threshold.toFixed(2)} for the coders ` +
            `${analysis.coderNames.join(', ')}. Each passage below is a paragraph that some, but not ` +
            `all, coders tagged with the code. Use it as a calibration worksheet: read each passage ` +
            `together, decide whether the code applies, and note the rule you agree on so the next ` +
            `round of coding is more consistent.`
        ),
      ],
    })
  );

  const lowCodes = codesBelowThreshold(analysis, threshold);

  if (lowCodes.length === 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `No codes fell below the ${threshold.toFixed(2)} threshold. Nothing to calibrate.`,
            italics: true,
          }),
        ],
      })
    );
  }

  lowCodes.forEach((code, idx) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: idx > 0,
        children: [new TextRun(code.name)],
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Kappa: ${formatKappa(code.result.kappa)} | Disagreement passages: ${code.disagreements.length}`,
            bold: true,
          }),
        ],
      })
    );

    if (code.disagreements.length === 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text:
                'This code is below threshold but the coders applied it to the same paragraphs, so ' +
                'there are no paragraph-level disagreements to review. The low kappa comes from ' +
                'differences in the exact character ranges highlighted.',
              italics: true,
            }),
          ],
        })
      );
    }

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

  return new Document({
    creator: 'Dedoose IRR Tool',
    title: 'Coder Calibration',
    sections: [{ children }],
  });
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
