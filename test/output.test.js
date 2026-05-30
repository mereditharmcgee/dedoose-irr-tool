import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ExcelJS from 'exceljs';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { parseDedooseDocx } from '../src/parsers/dedoose.js';
import { analyze } from '../src/kappa/analyze.js';
import { buildKappaReport } from '../src/output/kappa_report.js';
import { buildCalibrationDocument, codesBelowThreshold } from '../src/output/calibration_doc.js';

const HERE = dirname(fileURLToPath(import.meta.url));

async function load(name, displayName) {
  const buf = await readFile(join(HERE, 'fixtures', `${name}.docx`));
  return parseDedooseDocx(buf, displayName);
}

describe('xlsx kappa report', () => {
  let analysis;
  beforeAll(async () => {
    analysis = analyze([await load('coder_a', 'Coder A'), await load('coder_b', 'Coder B')]);
  });

  it('produces a workbook with the three expected sheets', async () => {
    const blob = await buildKappaReport(analysis);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toEqual(['Summary', 'Per-code kappa', 'Methods text']);
  });

  it('writes the correct per-code kappa values', async () => {
    const blob = await buildKappaReport(analysis);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.getWorksheet('Per-code kappa');

    const rows = {};
    ws.eachRow((row, n) => {
      if (n === 1) return;
      rows[row.getCell(1).value] = row;
    });

    // Code | A% | B% | Kappa | Interp | Raw | both | either  -> kappa is col 4
    expect(rows['Legalization timeline'].getCell(4).value).toBe('1.000');
    expect(rows['Market saturation'].getCell(4).value).toBe('—');
    expect(rows['Social equity'].getCell(4).value).toBe('0.375');
    expect(rows['Social equity'].getCell(5).value).toBe('Fair');
  });

  it('freezes the header row', async () => {
    const blob = await buildKappaReport(analysis);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.getWorksheet('Per-code kappa');
    expect(ws.views[0].state).toBe('frozen');
    expect(ws.views[0].ySplit).toBe(1);
  });
});

describe('docx calibration document', () => {
  let analysis;
  beforeAll(async () => {
    analysis = analyze([await load('coder_a', 'Coder A'), await load('coder_b', 'Coder B')]);
  });

  it('selects only codes below the threshold', () => {
    const below = codesBelowThreshold(analysis, 0.4).map((c) => c.name).sort();
    // Enforcement (-1), Social equity (0.375), Personal use (0). Not timeline(1),
    // policy(0.58), or saturation(null).
    expect(below).toEqual(['Enforcement', 'Personal use', 'Social equity']);
  });

  it('renders the below-threshold codes and discussion prompts', async () => {
    const doc = buildCalibrationDocument(analysis, 0.4);
    const buffer = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml').async('string');

    expect(xml).toContain('Disagreement Passages');
    expect(xml).toContain('Social equity');
    expect(xml).toContain('Enforcement');
    expect(xml).toContain('Discussion:');
    expect(xml).toContain('Applied by:');
    // A code with kappa 1.0 must not appear as a calibration heading.
    expect(xml).not.toContain('Legalization timeline');
  });

  it('respects a stricter threshold', async () => {
    const doc = buildCalibrationDocument(analysis, 0.6);
    const buffer = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml').async('string');
    // At 0.60, Policy views (0.583) now qualifies too.
    expect(xml).toContain('Policy views');
  });
});
