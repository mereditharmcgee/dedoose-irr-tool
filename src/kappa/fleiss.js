// Fleiss' kappa for three or more raters on a binary (character-level)
// coverage array. Each subject i is one character position; raters either
// applied the code there (1) or did not (0).
//
//   yes[i] = sum over raters of array[i]
//   no[i]  = n_raters - yes[i]
//   P_i    = (yes[i]^2 + no[i]^2 - n_raters) / (n_raters * (n_raters - 1))
//   P_bar  = mean(P_i)
//   p_yes  = sum(yes) / (n * n_raters)
//   p_no   = 1 - p_yes
//   P_e    = p_yes^2 + p_no^2
//   kappa  = (P_bar - P_e) / (1 - P_e)
//
// Edge case: if P_e == 1 the code has no variance and kappa is undefined.

const EPS = 1e-12;

export function fleissKappa(arrays) {
  const nRaters = arrays.length;
  if (nRaters < 3) {
    throw new Error(`fleissKappa: needs >= 3 raters, got ${nRaters}`);
  }
  const n = arrays[0].length;
  for (const arr of arrays) {
    if (arr.length !== n) {
      throw new Error('fleissKappa: all rater arrays must be the same length');
    }
  }

  if (n === 0) {
    return emptyResult(nRaters);
  }

  let sumPi = 0;
  let totalYes = 0;
  let both = 0; // all raters applied
  let either = 0; // any rater applied
  const denom = nRaters * (nRaters - 1);

  for (let i = 0; i < n; i++) {
    let yes = 0;
    for (let r = 0; r < nRaters; r++) {
      if (arrays[r][i]) yes++;
    }
    const no = nRaters - yes;
    sumPi += (yes * yes + no * no - nRaters) / denom;
    totalYes += yes;
    if (yes === nRaters) both++;
    if (yes >= 1) either++;
  }

  const pBar = sumPi / n;
  const pYes = totalYes / (n * nRaters);
  const pNo = 1 - pYes;
  const pE = pYes * pYes + pNo * pNo;

  let kappa;
  let insufficientVariance = false;
  if (Math.abs(1 - pE) < EPS) {
    kappa = null;
    insufficientVariance = true;
  } else {
    kappa = (pBar - pE) / (1 - pE);
  }

  // Per-rater application rate, for the report columns.
  const rates = arrays.map((arr) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += arr[i] ? 1 : 0;
    return s / n;
  });

  return {
    method: 'fleiss',
    kappa,
    rawAgreement: pBar,
    pe: pE,
    n,
    insufficientVariance,
    bothApplied: both,
    eitherApplied: either,
    rates,
  };
}

function emptyResult(nRaters) {
  return {
    method: 'fleiss',
    kappa: null,
    rawAgreement: 0,
    pe: 1,
    n: 0,
    insufficientVariance: true,
    bothApplied: 0,
    eitherApplied: 0,
    rates: new Array(nRaters).fill(0),
  };
}
