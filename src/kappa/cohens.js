// Cohen's kappa for two raters on a binary (character-level) coverage array.
//
// Given two boolean arrays `a` and `b` of equal length n:
//   po   = sum(a == b) / n
//   p_a1 = mean(a)
//   p_b1 = mean(b)
//   pe   = p_a1*p_b1 + (1 - p_a1)*(1 - p_b1)
//   kappa = (po - pe) / (1 - pe)
//
// Edge case: if pe == 1 there is no variance to assess, so kappa is undefined.
// We return kappa: null and flag insufficientVariance. (This matches R's
// irr::kappa2, which yields NaN only when the expected-agreement denominator
// collapses to zero.)

// Guard against floating point: treat pe within EPS of 1 as exactly 1.
const EPS = 1e-12;

export function cohensKappa(a, b) {
  if (a.length !== b.length) {
    throw new Error(`cohensKappa: array length mismatch (${a.length} vs ${b.length})`);
  }
  const n = a.length;

  if (n === 0) {
    return emptyResult();
  }

  let agree = 0;
  let sumA = 0;
  let sumB = 0;
  let both = 0;
  let either = 0;

  for (let i = 0; i < n; i++) {
    const ai = a[i] ? 1 : 0;
    const bi = b[i] ? 1 : 0;
    if (ai === bi) agree++;
    if (ai && bi) both++;
    if (ai || bi) either++;
    sumA += ai;
    sumB += bi;
  }

  const po = agree / n;
  const pA1 = sumA / n;
  const pB1 = sumB / n;
  const pe = pA1 * pB1 + (1 - pA1) * (1 - pB1);

  let kappa;
  let insufficientVariance = false;
  if (Math.abs(1 - pe) < EPS) {
    kappa = null;
    insufficientVariance = true;
  } else {
    kappa = (po - pe) / (1 - pe);
  }

  return {
    method: 'cohen',
    kappa,
    rawAgreement: po,
    pe,
    n,
    insufficientVariance,
    bothApplied: both,
    eitherApplied: either,
    rates: [pA1, pB1],
  };
}

function emptyResult() {
  return {
    method: 'cohen',
    kappa: null,
    rawAgreement: 0,
    pe: 1,
    n: 0,
    insufficientVariance: true,
    bothApplied: 0,
    eitherApplied: 0,
    rates: [0, 0],
  };
}
