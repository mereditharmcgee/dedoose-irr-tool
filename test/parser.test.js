import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseDedooseXml, parseDedooseDocx } from '../src/parsers/dedoose.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const COMMENTS_XML = `<?xml version="1.0"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:comment w:id="0">
    <w:p><w:r><w:t>Codes (485-522)</w:t></w:r></w:p>
    <w:p><w:r><w:t>  Overall impressions about policy  </w:t></w:r></w:p>
    <w:p><w:r><w:t>Personal opinions - changed since legalization</w:t></w:r></w:p>
  </w:comment>
  <w:comment w:id="1">
    <w:p><w:r><w:t>Codes ( 10 - 40 )</w:t></w:r></w:p>
    <w:p><w:r><w:t>Enforcement</w:t></w:r></w:p>
  </w:comment>
  <w:comment w:id="2">
    <w:p><w:r><w:t>Reviewer note: looks good</w:t></w:r></w:p>
    <w:p><w:r><w:t>not a code</w:t></w:r></w:p>
  </w:comment>
</w:comments>`;

const DOCUMENT_XML = `<?xml version="1.0"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
  <w:p><w:r><w:t>First paragraph.</w:t></w:r></w:p>
  <w:p><w:r><w:t>Second </w:t></w:r><w:r><w:t>paragraph </w:t></w:r><w:r><w:commentReference w:id="0"/></w:r></w:p>
  <w:p><w:r><w:commentReference w:id="1"/></w:r><w:r><w:t>Third paragraph.</w:t></w:r></w:p>
</w:body></w:document>`;

describe('Dedoose XML parsing', () => {
  const parsed = parseDedooseXml({
    commentsXml: COMMENTS_XML,
    documentXml: DOCUMENT_XML,
    name: 'unit',
  });

  it('extracts ranges as integers from the Codes(...) header', () => {
    expect(parsed.comments[0].start).toBe(485);
    expect(parsed.comments[0].end).toBe(522);
    // tolerant of whitespace inside the parentheses
    expect(parsed.comments[1].start).toBe(10);
    expect(parsed.comments[1].end).toBe(40);
  });

  it('collects and trims each code name', () => {
    expect(parsed.comments[0].codes).toEqual([
      'Overall impressions about policy',
      'Personal opinions - changed since legalization',
    ]);
  });

  it('skips comments whose first paragraph is not a Codes(...) header', () => {
    // Only comments 0 and 1 are Dedoose code comments.
    expect(parsed.comments).toHaveLength(2);
  });

  it('computes the coded span from min(start) and max(end)', () => {
    expect(parsed.spanStart).toBe(10);
    expect(parsed.spanEnd).toBe(522);
  });

  it('maps commentReference ids to paragraph index and concatenated text', () => {
    expect(parsed.commentParagraphs['0'].paraIndex).toBe(1);
    expect(parsed.commentParagraphs['0'].text).toBe('Second paragraph ');
    expect(parsed.commentParagraphs['1'].paraIndex).toBe(2);
    expect(parsed.commentParagraphs['1'].text).toBe('Third paragraph.');
  });

  it('lists the unique sorted code set', () => {
    expect(parsed.codes).toEqual([
      'Enforcement',
      'Overall impressions about policy',
      'Personal opinions - changed since legalization',
    ]);
  });
});

describe('Dedoose .docx loading (real fixture)', () => {
  it('opens a generated fixture and reads its comments', async () => {
    const buf = await readFile(join(HERE, 'fixtures', 'coder_a.docx'));
    const parsed = await parseDedooseDocx(buf, 'coder_a');
    expect(parsed.comments).toHaveLength(6);
    expect(parsed.codes).toContain('Legalization timeline');
    expect(parsed.spanStart).toBe(0);
    expect(parsed.spanEnd).toBe(200);
    // anchor text comes back from document.xml
    const timeline = parsed.comments.find((c) => c.codes.includes('Legalization timeline'));
    expect(parsed.commentParagraphs[timeline.id].text).toContain('Legalization passed');
  });
});
