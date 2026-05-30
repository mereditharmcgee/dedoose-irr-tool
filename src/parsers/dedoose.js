// Parse a Dedoose coded-document .docx export.
//
// A .docx is a zip archive of XML. We only need two entries:
//   word/comments.xml  -> the code applications (each comment = one anchored
//                          range carrying one or more code names)
//   word/document.xml  -> the transcript body, used to recover the passage
//                          text behind each comment for the calibration doc.
//
// Comment shape in comments.xml:
//   <w:comment w:id="0">
//     <w:p><w:r><w:t>Codes (485-522)</w:t></w:r></w:p>   <- range header
//     <w:p>...code name...</w:p>                          <- one code per para
//     <w:p>...code name...</w:p>
//   </w:comment>
//
// The header's two integers are Dedoose's own character offsets into the
// transcript (NOT Word character offsets). Comments whose first paragraph does
// not match the Codes(...) pattern are non-Dedoose comments and are skipped.

import JSZip from 'jszip';

const CODES_RE = /Codes\s*\(\s*(\d+)\s*-\s*(\d+)\s*\)/;

// Load and parse a .docx from an ArrayBuffer / Uint8Array / Blob.
export async function parseDedooseDocx(input, name) {
  const zip = await JSZip.loadAsync(input);
  const commentsEntry = zip.file('word/comments.xml');
  const documentEntry = zip.file('word/document.xml');

  if (!commentsEntry) {
    throw new Error(
      `${name || 'file'}: no word/comments.xml found. This does not look like a ` +
        'coded Dedoose export (a coded document always carries comments).'
    );
  }

  const commentsXml = await commentsEntry.async('string');
  const documentXml = documentEntry ? await documentEntry.async('string') : '';
  return parseDedooseXml({ commentsXml, documentXml, name });
}

// Pure XML -> structure step, separated so it can be unit tested without a zip.
export function parseDedooseXml({ commentsXml, documentXml, name }) {
  const parser = new DOMParser();

  // --- comments.xml: extract ranges + code names ---
  const commentsDoc = parser.parseFromString(commentsXml, 'application/xml');
  const commentEls = commentsDoc.getElementsByTagName('w:comment');
  const comments = [];

  for (let i = 0; i < commentEls.length; i++) {
    const el = commentEls[i];
    const id = el.getAttribute('w:id');
    const paras = el.getElementsByTagName('w:p');
    if (paras.length === 0) continue;

    const header = paragraphText(paras[0]);
    const m = CODES_RE.exec(header);
    if (!m) continue; // not a Dedoose code comment

    const start = parseInt(m[1], 10);
    const end = parseInt(m[2], 10);

    const codes = [];
    for (let p = 1; p < paras.length; p++) {
      const t = paragraphText(paras[p]).trim();
      if (t) codes.push(t);
    }
    if (codes.length === 0) continue; // a range with no codes is not useful

    comments.push({ id, start, end, codes });
  }

  // --- document.xml: map each commentReference id -> {paraIndex, text} ---
  const commentParagraphs = {};
  if (documentXml) {
    const documentDoc = parser.parseFromString(documentXml, 'application/xml');
    const paraEls = documentDoc.getElementsByTagName('w:p');
    for (let idx = 0; idx < paraEls.length; idx++) {
      const refs = paraEls[idx].getElementsByTagName('w:commentReference');
      if (refs.length === 0) continue;
      const text = paragraphText(paraEls[idx]);
      for (let r = 0; r < refs.length; r++) {
        const refId = refs[r].getAttribute('w:id');
        // First anchor wins if an id somehow appears twice.
        if (!(refId in commentParagraphs)) {
          commentParagraphs[refId] = { paraIndex: idx, text };
        }
      }
    }
  }

  const codeSet = new Set();
  for (const c of comments) for (const code of c.codes) codeSet.add(code);

  const starts = comments.map((c) => c.start);
  const ends = comments.map((c) => c.end);

  return {
    name: name || null,
    comments,
    commentParagraphs,
    codes: [...codeSet].sort(),
    // The coder's coded SPAN: earliest start to latest end. See analysis.js
    // and docs/dedoose_format.md for why this (overlap-of-spans) rather than a
    // literal intersection of every comment.
    spanStart: starts.length ? Math.min(...starts) : null,
    spanEnd: ends.length ? Math.max(...ends) : null,
  };
}

// Concatenate the text of every <w:t> descendant of a paragraph element.
function paragraphText(pEl) {
  const tEls = pEl.getElementsByTagName('w:t');
  let out = '';
  for (let i = 0; i < tEls.length; i++) {
    out += tEls[i].textContent || '';
  }
  return out;
}
