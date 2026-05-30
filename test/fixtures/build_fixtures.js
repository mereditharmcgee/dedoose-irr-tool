// Generates the synthetic Dedoose .docx fixtures used by the tests.
//
// IMPORTANT: every word of the transcript below is invented. No real
// participant data is, or ever should be, used as a fixture. Run with:
//   npm run fixtures
//
// The coding scheme is engineered to exercise every kappa branch:
//   Legalization timeline -> identical ranges      -> kappa = 1.0 (perfect)
//   Enforcement           -> disjoint ranges       -> kappa = -1.0 (worse than chance)
//   Market saturation     -> both cover everything -> kappa = null (no variance)
//   Personal use          -> coder B applies zero  -> kappa = 0 (slight)
//   Social equity         -> small overlap         -> kappa = 0.375 (fair, < 0.40)
//   Policy views          -> large overlap         -> kappa = 0.583 (moderate)

import JSZip from 'jszip';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// Synthetic transcript paragraphs (index = paragraph position in document.xml).
const TRANSCRIPT = [
  'Interviewer: Thanks for making time today. To start, how would you describe the way cannabis policy has played out in your state?',
  'Participant: Honestly it has been a mixed bag. The rollout felt rushed and the licensing ended up favoring the big operators with money behind them.',
  'Participant: Legalization passed back in 2014, and the timeline since then has been one delay after another, especially for the equity programs they promised.',
  'Participant: Enforcement is where I have the strongest feelings. The old arrests still follow people I grew up with, even now.',
  'Participant: And on the enforcement side, even after legalization the policing in my neighborhood did not really change at all.',
  'Participant: Social equity was supposed to be the whole point. Instead the licenses went to whoever already had capital lined up.',
  'Participant: The market feels saturated now. There is a shop on every block and the prices have basically collapsed.',
  'Interviewer: That is really useful context. Is there anything you would change about how the whole thing unfolded?',
];

// Per-coder comments: { id, start, end, code, para }.
// start/end are Dedoose character offsets; para is the anchor paragraph index.
const CODERS = {
  coder_a: {
    author: 'Coder A',
    comments: [
      { id: 0, start: 0, end: 120, code: 'Policy views', para: 1 },
      { id: 1, start: 50, end: 100, code: 'Legalization timeline', para: 2 },
      { id: 2, start: 0, end: 100, code: 'Enforcement', para: 3 },
      { id: 3, start: 0, end: 40, code: 'Social equity', para: 5 },
      { id: 4, start: 0, end: 200, code: 'Market saturation', para: 6 },
      { id: 5, start: 140, end: 180, code: 'Personal use', para: 7 },
    ],
  },
  coder_b: {
    author: 'Coder B',
    comments: [
      { id: 0, start: 20, end: 140, code: 'Policy views', para: 1 },
      { id: 1, start: 50, end: 100, code: 'Legalization timeline', para: 2 },
      { id: 2, start: 100, end: 200, code: 'Enforcement', para: 4 },
      { id: 3, start: 20, end: 60, code: 'Social equity', para: 6 },
      { id: 4, start: 0, end: 200, code: 'Market saturation', para: 6 },
    ],
  },
  coder_c: {
    author: 'Coder C',
    comments: [
      { id: 0, start: 10, end: 130, code: 'Policy views', para: 1 },
      { id: 1, start: 50, end: 100, code: 'Legalization timeline', para: 2 },
      { id: 2, start: 0, end: 100, code: 'Enforcement', para: 3 },
      { id: 3, start: 20, end: 60, code: 'Social equity', para: 5 },
      { id: 4, start: 0, end: 200, code: 'Market saturation', para: 6 },
    ],
  },
};

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCommentsXml(comments) {
  const body = comments
    .map((c) => {
      const codeParas = [`Codes (${c.start}-${c.end})`, c.code]
        .map(
          (t) =>
            `<w:p><w:r><w:t xml:space="preserve">${escapeXml(t)}</w:t></w:r></w:p>`
        )
        .join('');
      return `<w:comment w:id="${c.id}" w:author="Coder" w:date="2026-01-01T00:00:00Z" w:initials="C">${codeParas}</w:comment>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${body}</w:comments>`;
}

function buildDocumentXml(comments) {
  // Group comment ids by anchor paragraph.
  const byPara = new Map();
  for (const c of comments) {
    if (!byPara.has(c.para)) byPara.set(c.para, []);
    byPara.get(c.para).push(c.id);
  }

  const paras = TRANSCRIPT.map((text, idx) => {
    const ids = byPara.get(idx) || [];
    const starts = ids.map((id) => `<w:commentRangeStart w:id="${id}"/>`).join('');
    const ends = ids
      .map(
        (id) =>
          `<w:commentRangeEnd w:id="${id}"/><w:r><w:commentReference w:id="${id}"/></w:r>`
      )
      .join('');
    return `<w:p>${starts}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>${ends}</w:p>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras}</w:body></w:document>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>
</Relationships>`;

async function buildDocx(comments) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', ROOT_RELS);
  zip.file('word/_rels/document.xml.rels', DOC_RELS);
  zip.file('word/document.xml', buildDocumentXml(comments));
  zip.file('word/comments.xml', buildCommentsXml(comments));
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function main() {
  for (const [filename, def] of Object.entries(CODERS)) {
    const buffer = await buildDocx(def.comments);
    const out = join(HERE, `${filename}.docx`);
    await writeFile(out, buffer);
    console.log(`wrote ${out} (${def.comments.length} comments)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
