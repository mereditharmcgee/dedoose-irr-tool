import { describe, it, expect } from 'vitest';
import {
  measureDistance,
  observedCategoryDisagreement,
  expectedCategoryDisagreement,
  alphaUCategory,
  alphaUOverall,
} from '../src/kappa/alpha_u.js';

// Fixture 2: the distance function, pinned by Krippendorff (2004) test cases.
describe('alpha_U distance function', () => {
  it('matches the published measureDistance cases exactly', () => {
    expect(measureDistance(5, 6, 'X', 5, 6, 'X')).toBe(0);
    expect(measureDistance(5, 6, 'X', 6, 4, 'X')).toBe(2);
    expect(measureDistance(5, 6, 'X', 7, 2, 'X')).toBe(8);
    expect(measureDistance(5, 6, 'X', 6, 2, 'X')).toBe(10);
    expect(measureDistance(5, 6, 'X', 5, 2, 'X')).toBe(16);
    expect(measureDistance(5, 6, 'X', 4, 2, 'X')).toBe(26);
    expect(measureDistance(225, 70, 'c', 220, 80, 'c')).toBe(50);
    expect(measureDistance(370, 30, 'c', 355, 20, 'c')).toBe(850);
    expect(measureDistance(400, 50, null, 400, 20, 'c')).toBe(400);
    expect(
      measureDistance(2, 3, null, 2, 2, 'X') + measureDistance(5, 6, 'X', 4, 7, null)
    ).toBe(40);
    expect(
      measureDistance(3, 2, null, 3, 2, 'X') + measureDistance(5, 6, 'X', 5, 6, null)
    ).toBe(40);
  });
});

// Fixture 1: Krippendorff (2004), p.254. Primary target.
describe('alpha_U — Krippendorff (2004) example', () => {
  const study = {
    B: 150,
    L: 300, // continuum [150, 450): UnitizingAnnotationStudy(rater, begin, LENGTH)
    R: 2,
    units: [
      { offset: 225, length: 70, rater: 0, category: 'c' },
      { offset: 370, length: 30, rater: 0, category: 'c' },
      { offset: 220, length: 80, rater: 1, category: 'c' },
      { offset: 355, length: 20, rater: 1, category: 'c' },
      { offset: 400, length: 20, rater: 1, category: 'c' },
      { offset: 180, length: 60, rater: 0, category: 'k' },
      { offset: 300, length: 50, rater: 0, category: 'k' },
      { offset: 180, length: 60, rater: 1, category: 'k' },
      { offset: 300, length: 50, rater: 1, category: 'k' },
    ],
  };

  it('reproduces the category-c disagreements and alpha', () => {
    expect(observedCategoryDisagreement(study, 'c')).toBeCloseTo(0.0144, 3);
    expect(expectedCategoryDisagreement(study, 'c')).toBeCloseTo(0.0532, 3);
    expect(alphaUCategory(study, 'c')).toBeCloseTo(0.7286, 3);
  });

  it('reproduces the category-k disagreements and alpha', () => {
    expect(observedCategoryDisagreement(study, 'k')).toBeCloseTo(0.0, 3);
    expect(expectedCategoryDisagreement(study, 'k')).toBeCloseTo(0.049, 3);
    expect(alphaUCategory(study, 'k')).toBeCloseTo(1.0, 3);
  });

  it('reproduces the overall alpha_U of 0.8591', () => {
    expect(alphaUOverall(study)).toBeCloseTo(0.8591, 3);
  });
});

// Fixture 3: Krippendorff (1995), p.57. Cross-check (observed disagreements are
// continuum-length independent).
function krippendorff1995(stretch) {
  const u = (offset, length, rater, category) => ({
    offset: Math.trunc(offset * stretch),
    length: Math.trunc(length * stretch),
    rater,
    category,
  });
  return {
    B: 0,
    L: Math.trunc(24 * stretch),
    R: 2,
    units: [
      u(2, 8, 0, 'A'), u(14, 6, 0, 'A'), u(4, 4, 1, 'A'), u(15, 2, 1, 'A'),
      u(0, 18, 0, 'B'), u(0, 2, 1, 'B'), u(2, 1, 1, 'B'), u(3, 1, 1, 'B'),
      u(4, 1, 1, 'B'), u(5, 1, 1, 'B'), u(6, 3, 1, 'B'), u(9, 1, 1, 'B'),
      u(2, 6, 0, 'C'), u(10, 2, 0, 'C'), u(14, 4, 0, 'C'), u(20, 2, 0, 'C'),
      u(0, 2, 1, 'C'), u(4, 4, 1, 'C'), u(10, 4, 1, 'C'), u(16, 2, 1, 'C'), u(20, 2, 1, 'C'),
      u(0, 2, 0, 'D'), u(2, 8, 0, 'D'), u(10, 4, 0, 'D'), u(14, 6, 0, 'D'), u(20, 4, 0, 'D'),
      u(0, 4, 1, 'D'), u(4, 4, 1, 'D'), u(8, 7, 1, 'D'), u(15, 2, 1, 'D'), u(17, 7, 1, 'D'),
    ],
  };
}

describe('alpha_U — Krippendorff (1995) example', () => {
  const study = krippendorff1995(1);

  it('reproduces the observed category disagreements', () => {
    expect(observedCategoryDisagreement(study, 'A')).toBeCloseTo(0.03125, 4);
    expect(observedCategoryDisagreement(study, 'B')).toBeCloseTo(2.26736, 4);
    expect(observedCategoryDisagreement(study, 'C')).toBeCloseTo(0.02777, 4);
    expect(observedCategoryDisagreement(study, 'D')).toBeCloseTo(0.38715, 4);
  });

  it('reproduces category-C alpha on a large continuum (~0.679)', () => {
    const big = krippendorff1995(1200000 / 24);
    // DKPro tolerances: expected disagreement +/-0.005, alpha +/-0.02.
    expect(Math.abs(expectedCategoryDisagreement(big, 'C') - 0.08642)).toBeLessThan(0.005);
    expect(Math.abs(alphaUCategory(big, 'C') - 0.679)).toBeLessThan(0.02);
  });
});
