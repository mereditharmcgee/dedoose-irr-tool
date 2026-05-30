import { describe, it, expect } from 'vitest';
import { cohensKappa } from '../src/kappa/cohens.js';
import { fleissKappa } from '../src/kappa/fleiss.js';
import { interpretKappa } from '../src/kappa/interpret.js';

// Helper: build an array from run-length segments of [value, count].
function runs(...segments) {
  const out = [];
  for (const [value, count] of segments) {
    for (let i = 0; i < count; i++) out.push(value);
  }
  return out;
}

describe("Cohen's kappa", () => {
  it('returns 1.0 for perfect agreement (with variance)', () => {
    const r = cohensKappa([true, true, false, false], [true, true, false, false]);
    expect(r.kappa).toBeCloseTo(1.0, 10);
    expect(r.rawAgreement).toBe(1);
    expect(r.insufficientVariance).toBe(false);
  });

  it('returns 0 for agreement exactly at chance', () => {
    const r = cohensKappa([true, true, false, false], [true, false, true, false]);
    expect(r.kappa).toBeCloseTo(0, 10);
    expect(r.rawAgreement).toBeCloseTo(0.5, 10);
  });

  it('returns negative for systematic disagreement', () => {
    const r = cohensKappa([true, true, false, false], [false, false, true, true]);
    expect(r.kappa).toBeCloseTo(-1.0, 10);
  });

  it('returns null when there is no variance (both raters constant)', () => {
    const r = cohensKappa([true, true, true, true], [true, true, true, true]);
    expect(r.kappa).toBeNull();
    expect(r.insufficientVariance).toBe(true);
  });

  // Textbook 2x2: both-yes=20, both-no=15, A-yes/B-no=5, A-no/B-yes=10 (n=50)
  // po = 0.70, pe = 0.50, kappa = 0.40
  it('matches a known 2x2 contingency table (kappa = 0.40)', () => {
    const a = runs([true, 20], [false, 15], [true, 5], [false, 10]);
    const b = runs([true, 20], [false, 15], [false, 5], [true, 10]);
    const r = cohensKappa(a, b);
    expect(r.n).toBe(50);
    expect(r.rawAgreement).toBeCloseTo(0.7, 10);
    expect(r.pe).toBeCloseTo(0.5, 10);
    expect(r.kappa).toBeCloseTo(0.4, 10);
    expect(r.bothApplied).toBe(20);
    expect(r.eitherApplied).toBe(35);
    expect(r.rates[0]).toBeCloseTo(0.5, 10);
    expect(r.rates[1]).toBeCloseTo(0.6, 10);
  });

  it('throws on length mismatch', () => {
    expect(() => cohensKappa([true], [true, false])).toThrow();
  });
});

describe("Fleiss' kappa", () => {
  it('returns 1.0 for perfect agreement across 3 raters', () => {
    const arr = [true, true, false, false];
    const r = fleissKappa([arr.slice(), arr.slice(), arr.slice()]);
    expect(r.kappa).toBeCloseTo(1.0, 10);
  });

  it('returns null when no variance (all raters apply everywhere)', () => {
    const arr = [true, true, true, true];
    const r = fleissKappa([arr.slice(), arr.slice(), arr.slice()]);
    expect(r.kappa).toBeNull();
    expect(r.insufficientVariance).toBe(true);
  });

  // Hand-computed: see test notes. kappa ~= 0.46428
  it('matches a hand-worked 3-rater example', () => {
    const r1 = [true, true, false, false, true];
    const r2 = [true, true, false, false, false];
    const r3 = [true, false, false, false, true];
    const r = fleissKappa([r1, r2, r3]);
    expect(r.n).toBe(5);
    expect(r.rawAgreement).toBeCloseTo(0.733333, 5);
    expect(r.pe).toBeCloseTo(0.502222, 5);
    expect(r.kappa).toBeCloseTo(0.464286, 5);
    expect(r.bothApplied).toBe(1);
    expect(r.eitherApplied).toBe(3);
    expect(r.rates[0]).toBeCloseTo(0.6, 10);
  });

  it('throws with fewer than 3 raters', () => {
    expect(() => fleissKappa([[true], [false]])).toThrow();
  });
});

describe('Landis-Koch interpretation', () => {
  it('maps kappa values to the right tier', () => {
    expect(interpretKappa(null).label).toMatch(/Undefined/);
    expect(interpretKappa(-0.1).label).toBe('Worse than chance');
    expect(interpretKappa(0).label).toBe('Slight');
    expect(interpretKappa(0.2).label).toBe('Slight');
    expect(interpretKappa(0.21).label).toBe('Fair');
    expect(interpretKappa(0.4).label).toBe('Fair');
    expect(interpretKappa(0.5).label).toBe('Moderate');
    expect(interpretKappa(0.7).label).toBe('Substantial');
    expect(interpretKappa(0.9).label).toBe('Almost perfect');
  });

  it('assigns colour tiers correctly', () => {
    expect(interpretKappa(0.85).tier).toBe('green');
    expect(interpretKappa(0.7).tier).toBe('green');
    expect(interpretKappa(0.5).tier).toBe('yellow');
    expect(interpretKappa(0.3).tier).toBe('red');
    expect(interpretKappa(null).tier).toBe('none');
  });
});
