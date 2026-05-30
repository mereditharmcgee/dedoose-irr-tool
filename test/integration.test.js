import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseDedooseDocx } from '../src/parsers/dedoose.js';
import { analyze } from '../src/kappa/analyze.js';

const HERE = dirname(fileURLToPath(import.meta.url));

async function load(name, displayName) {
  const buf = await readFile(join(HERE, 'fixtures', `${name}.docx`));
  return parseDedooseDocx(buf, displayName);
}

function byCode(analysis, name) {
  return analysis.codes.find((c) => c.name === name);
}

describe('End-to-end: two coders (Cohen)', () => {
  let analysis;
  beforeAll(async () => {
    const a = await load('coder_a', 'Coder A');
    const b = await load('coder_b', 'Coder B');
    analysis = analyze([a, b]);
  });

  it('uses Cohen and the full common window', () => {
    expect(analysis.method).toBe('cohen');
    expect(analysis.commonStart).toBe(0);
    expect(analysis.commonEnd).toBe(200);
    expect(analysis.commonLength).toBe(200);
    expect(analysis.codeCount).toBe(6);
  });

  it('perfect agreement -> kappa 1.0', () => {
    expect(byCode(analysis, 'Legalization timeline').result.kappa).toBeCloseTo(1.0, 10);
  });

  it('disjoint ranges -> kappa -1.0 (worse than chance)', () => {
    const e = byCode(analysis, 'Enforcement');
    expect(e.result.kappa).toBeCloseTo(-1.0, 10);
    expect(e.interpretation.label).toBe('Worse than chance');
  });

  it('no variance -> null kappa', () => {
    const s = byCode(analysis, 'Market saturation');
    expect(s.result.kappa).toBeNull();
    expect(s.result.insufficientVariance).toBe(true);
  });

  it('one coder applies zero times -> kappa 0 (defined, per the formula)', () => {
    expect(byCode(analysis, 'Personal use').result.kappa).toBeCloseTo(0, 10);
  });

  it('small overlap -> fair (0.375)', () => {
    expect(byCode(analysis, 'Social equity').result.kappa).toBeCloseTo(0.375, 6);
  });

  it('large overlap -> moderate (~0.583)', () => {
    const p = byCode(analysis, 'Policy views');
    expect(p.result.kappa).toBeCloseTo(0.583333, 5);
    expect(p.result.bothApplied).toBe(100);
    expect(p.result.eitherApplied).toBe(140);
  });

  it('pooled kappa across all codes (~0.4599)', () => {
    expect(analysis.pooled.result.n).toBe(1200);
    expect(analysis.pooled.result.rawAgreement).toBeCloseTo(0.733333, 5);
    expect(analysis.pooled.result.kappa).toBeCloseTo(0.459915, 5);
    expect(analysis.pooled.result.bothApplied).toBe(370);
    expect(analysis.pooled.result.eitherApplied).toBe(690);
  });

  it('surfaces disagreement passages for a low-kappa code', () => {
    const equity = byCode(analysis, 'Social equity');
    // Coder A anchored equity at para 5, coder B at para 6 -> two disagreements.
    expect(equity.disagreements.length).toBe(2);
    const para5 = equity.disagreements.find((d) => d.paraIndex === 5);
    expect(para5.appliedBy).toEqual(['Coder A']);
    expect(para5.notAppliedBy).toEqual(['Coder B']);
    expect(para5.text).toContain('Social equity was supposed to be the whole point');
  });
});

describe('End-to-end: three coders (Fleiss)', () => {
  let analysis;
  beforeAll(async () => {
    const a = await load('coder_a', 'Coder A');
    const b = await load('coder_b', 'Coder B');
    const c = await load('coder_c', 'Coder C');
    analysis = analyze([a, b, c]);
  });

  it('uses Fleiss', () => {
    expect(analysis.method).toBe('fleiss');
    expect(analysis.nRaters).toBe(3);
  });

  it('perfect agreement across three -> 1.0', () => {
    expect(byCode(analysis, 'Legalization timeline').result.kappa).toBeCloseTo(1.0, 10);
  });

  it('no variance -> null', () => {
    expect(byCode(analysis, 'Market saturation').result.kappa).toBeNull();
  });

  it('enforcement (2 vs 1 split) -> -0.3333', () => {
    expect(byCode(analysis, 'Enforcement').result.kappa).toBeCloseTo(-0.333333, 5);
  });

  it('policy views (graded overlap) -> 0.7222', () => {
    expect(byCode(analysis, 'Policy views').result.kappa).toBeCloseTo(0.722222, 5);
  });

  it('reports pairwise Cohen kappa for all three pairs', () => {
    expect(analysis.pairwise).toHaveLength(3);
    expect(analysis.pairwise.map((p) => p.names)).toEqual([
      ['Coder A', 'Coder B'],
      ['Coder A', 'Coder C'],
      ['Coder B', 'Coder C'],
    ]);
  });

  it('three-way disagreement passages reflect who applied the code', () => {
    const equity = byCode(analysis, 'Social equity');
    // A->para5, B->para6, C->para5. para5: A,C applied / B not. para6: B / A,C not.
    const para5 = equity.disagreements.find((d) => d.paraIndex === 5);
    expect(para5.appliedBy.sort()).toEqual(['Coder A', 'Coder C']);
    expect(para5.notAppliedBy).toEqual(['Coder B']);
  });
});
