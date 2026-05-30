// Exports the exact character-level coverage matrices from the fixtures so R's
// `irr` package can compute kappa on identical input and confirm our math.
//
// Run from the repo root:  node docs/validation/export_for_r.mjs
// Then:                    Rscript docs/validation/validate.R
//
// Writes (into this folder):
//   coverage_ab.csv   one row per character: code, A, B   (0/1)
//   coverage_abc.csv  one row per character: code, A, B, C (0/1)
//   expected.csv      this tool's kappa per code, for a side-by-side check

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseDedooseDocx } from '../../src/parsers/dedoose.js';
import { buildCoverageMatrices, analyze } from '../../src/kappa/analyze.js';
import { DOMParser } from '@xmldom/xmldom';

// The browser-native DOMParser is not present in Node.
if (!globalThis.DOMParser) globalThis.DOMParser = DOMParser;

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', '..', 'test', 'fixtures');

async function load(name) {
  const buf = await readFile(join(FIXTURES, `${name}.docx`));
  return parseDedooseDocx(buf, name);
}

function coverageCsv(coders) {
  const { commonLength, codeNames, coverageByCode } = buildCoverageMatrices(coders);
  const header = ['code', ...coders.map((c) => c.name)].join(',');
  const lines = [header];
  for (const code of codeNames) {
    const arrays = coverageByCode.get(code);
    for (let i = 0; i < commonLength; i++) {
      const cells = arrays.map((a) => (a[i] ? 1 : 0));
      lines.push([csvField(code), ...cells].join(','));
    }
  }
  return lines.join('\n') + '\n';
}

function expectedCsv(coders) {
  const a = analyze(coders);
  const lines = ['code,kappa'];
  for (const code of a.codes) {
    lines.push(`${csvField(code.name)},${code.result.kappa === null ? 'NA' : code.result.kappa}`);
  }
  lines.push(`${csvField('POOLED')},${a.pooled.result.kappa}`);
  return lines.join('\n') + '\n';
}

function csvField(s) {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const a = await load('coder_a');
const b = await load('coder_b');
const c = await load('coder_c');

await writeFile(join(HERE, 'coverage_ab.csv'), coverageCsv([a, b]));
await writeFile(join(HERE, 'coverage_abc.csv'), coverageCsv([a, b, c]));
await writeFile(join(HERE, 'expected.csv'), expectedCsv([a, b]));

console.log('Wrote coverage_ab.csv, coverage_abc.csv, expected.csv to docs/validation/');
