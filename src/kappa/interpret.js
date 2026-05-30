// Landis & Koch (1977) interpretation of a kappa coefficient.
//
//   < 0          Worse than chance
//   0.00 – 0.20  Slight
//   0.21 – 0.40  Fair
//   0.41 – 0.60  Moderate
//   0.61 – 0.80  Substantial
//   0.81 – 1.00  Almost perfect
//   null         Undefined (no variance)
//
// `tier` drives the colour coding in the results table and the xlsx report:
//   green  -> substantial / almost perfect
//   yellow -> moderate
//   red    -> fair and below
//   none   -> undefined

export function interpretKappa(kappa) {
  if (kappa === null || kappa === undefined || Number.isNaN(kappa)) {
    return { label: 'Undefined (no variance)', tier: 'none' };
  }
  if (kappa < 0) return { label: 'Worse than chance', tier: 'red' };
  if (kappa <= 0.20) return { label: 'Slight', tier: 'red' };
  if (kappa <= 0.40) return { label: 'Fair', tier: 'red' };
  if (kappa <= 0.60) return { label: 'Moderate', tier: 'yellow' };
  if (kappa <= 0.80) return { label: 'Substantial', tier: 'green' };
  return { label: 'Almost perfect', tier: 'green' };
}

// The reference table, reused verbatim in the xlsx report so the user has the
// scale alongside their numbers.
export const LANDIS_KOCH_TABLE = [
  { range: '< 0.00', label: 'Worse than chance' },
  { range: '0.00 – 0.20', label: 'Slight' },
  { range: '0.21 – 0.40', label: 'Fair' },
  { range: '0.41 – 0.60', label: 'Moderate' },
  { range: '0.61 – 0.80', label: 'Substantial' },
  { range: '0.81 – 1.00', label: 'Almost perfect' },
];
