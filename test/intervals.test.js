import { describe, it, expect } from 'vitest';
import { cohensKappaCI, clusterBootstrapKappaCI } from '../src/kappa/intervals.js';
import { cohensKappa } from '../src/kappa/cohens.js';

function runs(...segments) {
  const out = [];
  for (const [value, count] of segments) for (let i = 0; i < count; i++) out.push(value);
  return out;
}

const kappaOf = (arrs) => cohensKappa(arrs[0], arrs[1]).kappa;

describe('Cohen kappa asymptotic CI (retained for validation only)', () => {
  // Textbook 2x2 -> kappa 0.40, SE 0.126996, 95% CI [0.1511, 0.6489].
  const A = runs([true, 20], [false, 15], [true, 5], [false, 10]);
  const B = runs([true, 20], [false, 15], [false, 5], [true, 10]);

  it('matches the hand-computed Fleiss-Cohen-Everitt variance', () => {
    const ci = cohensKappaCI(A, B, 0.95);
    expect(ci.se).toBeCloseTo(0.126996, 5);
    expect(ci.lower).toBeCloseTo(0.1511, 3);
    expect(ci.upper).toBeCloseTo(0.6489, 3);
  });

  it('returns null when there is no variance', () => {
    expect(cohensKappaCI([true, true, true], [true, true, true])).toBeNull();
  });
});

describe('Segment-clustered bootstrap CI (used by the app)', () => {
  // Six alternating segments, partial agreement (disagree on segments 3 and 4).
  const a = runs([true, 20], [false, 20], [true, 20], [false, 20], [true, 20], [false, 20]);
  const b = runs([true, 20], [false, 20], [false, 20], [true, 20], [true, 20], [false, 20]);
  const point = cohensKappa(a, b).kappa;

  it('brackets the point estimate and reports the segment count', () => {
    const ci = clusterBootstrapKappaCI([[a, b]], kappaOf, { B: 2000, seed: 3 });
    expect(ci.method).toBe('cluster-bootstrap');
    expect(ci.segments).toBe(6);
    expect(ci.lower).toBeLessThan(point);
    expect(ci.upper).toBeGreaterThan(point);
  });

  it('is much wider than the (wrong) character-level asymptotic CI', () => {
    const boot = clusterBootstrapKappaCI([[a, b]], kappaOf, { B: 2000, seed: 3 });
    const asym = cohensKappaCI(a, b);
    const bootWidth = boot.upper - boot.lower;
    const asymWidth = asym.upper - asym.lower;
    expect(bootWidth).toBeGreaterThan(asymWidth);
  });

  it('returns null for perfect agreement (no variation to resample)', () => {
    const same = runs([true, 30], [false, 30], [true, 30]);
    expect(clusterBootstrapKappaCI([[same, same.slice()]], kappaOf, { B: 500 })).toBeNull();
  });

  it('returns null when there are too few segments', () => {
    const a2 = runs([true, 20], [false, 20]); // 2 segments
    const b2 = runs([true, 20], [false, 20]);
    expect(clusterBootstrapKappaCI([[a2, b2]], kappaOf, { B: 500 })).toBeNull();
  });

  it('is reproducible for a fixed seed', () => {
    const x = clusterBootstrapKappaCI([[a, b]], kappaOf, { B: 500, seed: 9 });
    const y = clusterBootstrapKappaCI([[a, b]], kappaOf, { B: 500, seed: 9 });
    expect(x.lower).toBe(y.lower);
    expect(x.upper).toBe(y.upper);
  });
});
