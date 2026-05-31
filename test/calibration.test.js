import { describe, it, expect } from 'vitest';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { buildCalibrationDocument } from '../src/output/calibration_doc.js';

function code(name, kappa, label, disagreements = []) {
  return { name, result: { kappa }, interpretation: { label, tier: 'none' }, disagreements };
}

function passage(paraIndex, appliedBy, notAppliedBy, text) {
  return { paraIndex, appliedBy, notAppliedBy, text };
}

// A realistic shape: the reviewable disagreements live in HIGH-kappa codes,
// while the low-kappa codes are boundary-only (no passages) — exactly the case
// real data exposed.
const analysis = {
  coderNames: ['Faith', 'Meredith'],
  codes: [
    code('HighWithDisagreement', 0.95, 'Almost perfect', [
      passage(55, ['Faith'], ['Meredith'], 'a passage about tax revenue'),
    ]),
    code('LowWithDisagreement', 0.30, 'Fair', [
      passage(12, ['Meredith'], ['Faith'], 'a contested passage'),
    ]),
    code('LowNoPassages', 0.40, 'Fair', []),
    code('HighNoPassages', 0.99, 'Almost perfect', []),
  ],
};

async function xmlOf(doc) {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  return zip.file('word/document.xml').async('string');
}

describe('Calibration document, reorganised around disagreements', () => {
  it('puts codes with disagreements in section 1 regardless of their kappa', async () => {
    const xml = await xmlOf(buildCalibrationDocument(analysis, 0.45));
    expect(xml).toContain('Passages to review together');
    expect(xml).toContain('HighWithDisagreement'); // high kappa but has a passage
    expect(xml).toContain('LowWithDisagreement');
    expect(xml).toContain('a passage about tax revenue');
    expect(xml).toContain('Discussion:');
  });

  it('orders section 1 by ascending kappa (lowest agreement first)', async () => {
    const xml = await xmlOf(buildCalibrationDocument(analysis, 0.45));
    expect(xml.indexOf('LowWithDisagreement')).toBeLessThan(xml.indexOf('HighWithDisagreement'));
  });

  it('moves low-kappa codes without passages into the second section', async () => {
    const xml = await xmlOf(buildCalibrationDocument(analysis, 0.45));
    expect(xml).toContain('Lower agreement, but no specific passages');
    expect(xml).toContain('LowNoPassages'); // 0.40 < 0.45, no passages
  });

  it('excludes high-kappa codes with no passages entirely', async () => {
    const xml = await xmlOf(buildCalibrationDocument(analysis, 0.45));
    expect(xml).not.toContain('HighNoPassages');
  });

  it('omits the second section when no low codes lack passages', async () => {
    const xml = await xmlOf(buildCalibrationDocument(analysis, 0.1));
    // threshold 0.10: LowNoPassages (0.40) no longer qualifies
    expect(xml).not.toContain('Lower agreement, but no specific passages');
    // but the real disagreements are still shown
    expect(xml).toContain('HighWithDisagreement');
  });

  it('handles the case of no disagreements anywhere', async () => {
    const clean = { coderNames: ['A', 'B'], codes: [code('Agreed', 0.9, 'Almost perfect', [])] };
    const xml = await xmlOf(buildCalibrationDocument(clean, 0.4));
    expect(xml).toContain('No passages where some coders applied a code');
  });
});
