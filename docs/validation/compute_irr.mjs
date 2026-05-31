// Run the full analysis pipeline on real exports and print ONLY the statistical
// results (kappa table, pooled kappa, CI). Never prints passage text or any
// disagreement-passage content.
//
//   node docs/validation/compute_irr.mjs "Coder1Name" "file1.docx" "Coder2Name" "file2.docx"

import { readFile } from 'node:fs/promises';
import { DOMParser } from '@xmldom/xmldom';
import { parseDedooseDocx } from '../../src/parsers/dedoose.js';
import { analyze } from '../../src/kappa/analyze.js';

if (!globalThis.DOMParser) globalThis.DOMParser = DOMParser;

const args = process.argv.slice(2);
const pairs = [];
for (let i = 0; i < args.length; i += 2) pairs.push({ name: args[i], path: args[i + 1] });

const coders = [];
for (const p of pairs) coders.push(await parseDedooseDocx(await readFile(p.path), p.name));

const a = analyze(coders);

const f3 = (x) => (x === null ? '   —  ' : x.toFixed(3).padStart(6));
const pct = (x) => `${(x * 100).toFixed(0)}%`.padStart(4);

console.log('\nMethod:', a.method, '| coders:', a.coderNames.join(', '));
console.log('Common window:', `[${a.commonStart}, ${a.commonEnd}]`, `(${a.commonLength} chars)`, '| codes:', a.codeCount);
console.log('\nOVERALL pooled kappa:', f3(a.pooled.result.kappa), `(${a.pooled.interpretation.label})`);
console.log('  raw agreement:', pct(a.pooled.result.rawAgreement));
if (a.pooled.ci) console.log('  95% CI:', `[${a.pooled.ci.lower.toFixed(3)}, ${a.pooled.ci.upper.toFixed(3)}]`, `(${a.pooled.ci.segments} segments)`);

console.log('\nPER-CODE');
console.log('kappa  | raw  | ' + a.coderNames.map((n) => n.slice(0, 8).padStart(8)).join(' | ') + ' | code');
for (const c of a.codes) {
  const rates = c.result.rates.map((r) => pct(r).padStart(8)).join(' | ');
  console.log(`${f3(c.result.kappa)} | ${pct(c.result.rawAgreement)} | ${rates} | ${c.name} (${c.interpretation.label})`);
}

const totalDisagreements = a.codes.reduce((s, c) => s + c.disagreements.length, 0);
console.log('\nDisagreement passages available for calibration doc:', totalDisagreements, '(text not shown here)');
