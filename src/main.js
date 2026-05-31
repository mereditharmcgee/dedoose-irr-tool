// Entry point: wire the drop zone, parsing, analysis, rendering, downloads,
// the calibration threshold slider, and the dark-mode toggle. All state lives
// here; nothing is persisted except two UI preferences in localStorage.

import { saveAs } from 'file-saver';
import { parseDedooseDocx } from './parsers/dedoose.js';
import { analyze } from './kappa/analyze.js';
import { createDropZone } from './ui/upload.js';
import { renderHeadline, renderStats } from './ui/summary.js';
import { renderResultsTable } from './ui/results.js';
import { renderParseDetails } from './ui/parse_details.js';

const PREFS = { threshold: 'irr.threshold', theme: 'irr.theme' };

const els = {
  zone: document.getElementById('dropzone'),
  input: document.getElementById('file-input'),
  status: document.getElementById('status'),
  results: document.getElementById('results'),
  headline: document.getElementById('headline'),
  parseDetails: document.getElementById('parse-details'),
  table: document.getElementById('results-table'),
  stats: document.getElementById('summary-stats'),
  xlsxBtn: document.getElementById('download-xlsx'),
  docxBtn: document.getElementById('download-docx'),
  slider: document.getElementById('threshold-slider'),
  thresholdValue: document.getElementById('threshold-value'),
  themeToggle: document.getElementById('theme-toggle'),
};

let analysis = null;
let coders = null;
let threshold = clampThreshold(parseFloat(localStorage.getItem(PREFS.threshold)) || 0.4);

initTheme();
initThreshold();
initDownloads();

createDropZone(els.zone, els.input, handleFiles);

// ---------- file handling ----------

async function handleFiles(docxFiles, totalCount) {
  if (docxFiles.length !== totalCount) {
    return showError('Please drop only .docx files (Dedoose exports).');
  }
  if (docxFiles.length < 2 || docxFiles.length > 3) {
    return showError(
      `This tool compares 2 or 3 coders. You provided ${docxFiles.length} file${
        docxFiles.length === 1 ? '' : 's'
      }.`
    );
  }

  const stopSpinner = startSpinnerAfter(500);
  try {
    coders = await Promise.all(
      docxFiles.map((file) => parseDedooseDocx(file, stripExt(file.name)))
    );
    analysis = analyze(coders);
    stopSpinner();
    clearStatus();
    render();
  } catch (err) {
    stopSpinner();
    showError(err?.message || 'Something went wrong reading those files.');
    console.error(err);
  }
}

function render() {
  renderHeadline(els.headline, analysis);
  renderParseDetails(els.parseDetails, coders, analysis);
  renderResultsTable(els.table, analysis, threshold);
  renderStats(els.stats, analysis);
  els.results.hidden = false;
  els.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- downloads ----------

function initDownloads() {
  // The xlsx/docx libraries are heavy, so they are code-split and loaded only
  // when the user actually downloads — keeping the initial page load fast.
  els.xlsxBtn.addEventListener('click', () => withBusy(els.xlsxBtn, async () => {
    if (!analysis) return;
    const { buildKappaReport } = await import('./output/kappa_report.js');
    const blob = await buildKappaReport(analysis);
    saveAs(blob, 'kappa-report.xlsx');
  }));
  els.docxBtn.addEventListener('click', () => withBusy(els.docxBtn, async () => {
    if (!analysis) return;
    const { buildCalibrationDocBlob } = await import('./output/calibration_doc.js');
    const blob = await buildCalibrationDocBlob(analysis, threshold);
    saveAs(blob, 'calibration-document.docx');
  }));
}

// ---------- threshold ----------

function initThreshold() {
  els.slider.value = String(threshold);
  els.thresholdValue.textContent = threshold.toFixed(2);
  els.slider.addEventListener('input', () => {
    threshold = clampThreshold(parseFloat(els.slider.value));
    els.thresholdValue.textContent = threshold.toFixed(2);
    localStorage.setItem(PREFS.threshold, String(threshold));
    if (analysis) renderResultsTable(els.table, analysis, threshold);
  });
}

// ---------- theme ----------

function initTheme() {
  const saved = localStorage.getItem(PREFS.theme);
  if (saved) document.documentElement.dataset.theme = saved;
  syncThemeLabel();
  els.themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(PREFS.theme, next);
    syncThemeLabel();
  });
}

function syncThemeLabel() {
  const dark = document.documentElement.dataset.theme === 'dark';
  els.themeToggle.textContent = dark ? 'Light' : 'Dark';
}

// ---------- helpers ----------

function startSpinnerAfter(ms) {
  let shown = false;
  const t = setTimeout(() => {
    shown = true;
    els.status.innerHTML = '<span class="spinner">Reading and scoring your files…</span>';
  }, ms);
  return () => {
    clearTimeout(t);
    if (shown) clearStatus();
  };
}

async function withBusy(btn, fn) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generating…';
  try {
    await fn();
  } catch (err) {
    showError(err?.message || 'Could not generate that file.');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

function showError(msg) {
  els.status.innerHTML = `<div class="error">${escapeHtml(msg)}</div>`;
}
function clearStatus() {
  els.status.innerHTML = '';
}
function clampThreshold(v) {
  if (Number.isNaN(v)) return 0.4;
  return Math.min(1, Math.max(0, v));
}
function stripExt(name) {
  return name.replace(/\.docx$/i, '');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
