// Structure-only inspector for a real Dedoose .docx export.
//
// Reports ONLY structural facts (comment counts, character offsets, code
// names, anchoring) so the parser can be validated against a real file WITHOUT
// pulling any transcript text or participant content into view. It never prints
// passage text, paragraph text, or skipped-comment samples.
//
//   node docs/validation/inspect_export.mjs "file_a.docx" "file_b.docx"

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { parseDedooseDocx } from '../../src/parsers/dedoose.js';

if (!globalThis.DOMParser) globalThis.DOMParser = DOMParser;

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function countBy(items, keyFn) {
  const m = new Map();
  for (const it of items) m.set(keyFn(it), (m.get(keyFn(it)) || 0) + 1);
  return [...m.entries()];
}

const files = process.argv.slice(2);
const parsedAll = [];

for (const path of files) {
  const buf = await readFile(path);
  const zip = await JSZip.loadAsync(buf);
  const entries = Object.keys(zip.files);
  const parsed = await parseDedooseDocx(buf, basename(path));
  parsedAll.push(parsed);

  const d = parsed.diagnostics;
  const starts = parsed.comments.map((c) => c.start);
  const ends = parsed.comments.map((c) => c.end);
  const sizes = parsed.comments.map((c) => c.end - c.start);
  const codesPerComment = parsed.comments.map((c) => c.codes.length);

  console.log('\n============================================================');
  console.log('FILE:', basename(path));
  console.log('zip entries (word/*):', entries.filter((e) => e.startsWith('word/')).join(', '));
  console.log('has comments.xml:', !!zip.file('word/comments.xml'), ' has document.xml:', d.hasDocument);
  console.log('--- comments ---');
  console.log('total comments in file:', d.totalComments);
  console.log('matched code comments:', d.codeComments);
  console.log('skipped:', d.skippedCount, '->', countBy(d.skipped, (s) => s.reason));
  console.log('codes per comment (min/median/max):', sizes.length ? `${Math.min(...codesPerComment)}/${median(codesPerComment)}/${Math.max(...codesPerComment)}` : 'n/a');
  console.log('--- offsets (the "Codes (start-end)" numbers) ---');
  console.log('start min/max:', starts.length ? `${Math.min(...starts)} / ${Math.max(...starts)}` : 'n/a');
  console.log('end min/max:', ends.length ? `${Math.min(...ends)} / ${Math.max(...ends)}` : 'n/a');
  console.log('range size min/median/max:', sizes.length ? `${Math.min(...sizes)} / ${median(sizes)} / ${Math.max(...sizes)}` : 'n/a');
  console.log('coded span [min start, max end]:', `[${parsed.spanStart}, ${parsed.spanEnd}]`);
  console.log('--- anchoring (passage extraction) ---');
  console.log('code comments anchored to a paragraph:', d.anchored, 'of', d.codeComments);
  console.log('--- codebook (code NAMES, your analytic labels) ---');
  console.log('distinct codes:', parsed.codes.length);
  console.log(parsed.codes.map((c) => `  - ${c}`).join('\n'));
}

if (parsedAll.length >= 2) {
  const commonStart = Math.max(...parsedAll.map((p) => p.spanStart));
  const commonEnd = Math.min(...parsedAll.map((p) => p.spanEnd));
  const sharedCodes = parsedAll
    .map((p) => new Set(p.codes))
    .reduce((acc, s) => new Set([...acc].filter((x) => s.has(x))));
  console.log('\n============================================================');
  console.log('CROSS-FILE (would the tool compare these?)');
  console.log('overlap-of-spans common window:', `[${commonStart}, ${commonEnd}]`, 'length', Math.max(0, commonEnd - commonStart));
  console.log('codes in common across files:', sharedCodes.size);
}
