// Krippendorff's unitizing alpha (alpha_U) for the reliability of freely
// unitized continuous text. See docs/alpha_u_spec.md for the locked formula and
// validation targets. The algorithm follows Krippendorff (1995, 2004); the
// transcription was checked against the DKPro Agreement reference (Apache-2.0),
// whose tests reproduce Krippendorff's published worked examples.
//
// Study model:
//   { B, L, R, units: [{ offset, length, rater, category }] }
//   continuum [B, B+L); R raters; each unit is one coder's coded segment for a
//   category. Regions a coder did not code for a category are implicit gaps.
//   A single coder's units for the same category must not overlap.

// Distance between two units (or a unit and a gap, category === null).
export function measureDistance(offset1, length1, category1, offset2, length2, category2) {
  const beginDiff = offset1 - offset2;
  const lengthDiff = length1 - length2;
  if (category1 != null && category2 != null && -length1 < beginDiff && beginDiff < length2) {
    // both coded and overlapping: (Δstart)^2 + (Δend)^2
    return beginDiff * beginDiff + (beginDiff + lengthDiff) * (beginDiff + lengthDiff);
  } else if (category1 != null && category2 == null && -lengthDiff >= beginDiff && beginDiff >= 0) {
    // unit1 sits entirely within rater2's gap
    return length1 * length1;
  } else if (category1 == null && category2 != null && -lengthDiff <= beginDiff && beginDiff <= 0) {
    // unit2 sits entirely within rater1's gap
    return length2 * length2;
  }
  return 0;
}

function raterCategoryUnits(study, rater, category) {
  return study.units
    .filter((u) => u.rater === rater && u.category === category)
    .sort((a, b) => a.offset - b.offset);
}

export function observedCategoryDisagreement(study, category) {
  const { B, L, R } = study;
  let result = 0;

  for (let r1 = 0; r1 < R; r1++) {
    for (let r2 = r1 + 1; r2 < R; r2++) {
      const u1 = raterCategoryUnits(study, r1, category);
      const u2 = raterCategoryUnits(study, r2, category);
      let p1 = 0;
      let p2 = 0;
      let nextUnit1 = p1 < u1.length ? u1[p1++] : null;
      let nextUnit2 = p2 < u2.length ? u2[p2++] : null;
      let offset1 = B;
      let length1 = 0;
      let category1 = null;
      let offset2 = B;
      let length2 = 0;
      let category2 = null;
      let pos = B;

      while (pos < B + L && (nextUnit1 !== null || nextUnit2 !== null)) {
        if (pos === offset1 + length1) {
          if (nextUnit1 !== null && pos === nextUnit1.offset) {
            length1 = nextUnit1.length;
            category1 = nextUnit1.category;
            nextUnit1 = p1 < u1.length ? u1[p1++] : null;
          } else {
            length1 = (nextUnit1 !== null ? nextUnit1.offset : B + L) - pos;
            category1 = null;
          }
          offset1 = pos;
        }
        if (pos === offset2 + length2) {
          if (nextUnit2 !== null && pos === nextUnit2.offset) {
            length2 = nextUnit2.length;
            category2 = nextUnit2.category;
            nextUnit2 = p2 < u2.length ? u2[p2++] : null;
          } else {
            length2 = (nextUnit2 !== null ? nextUnit2.offset : B + L) - pos;
            category2 = null;
          }
          offset2 = pos;
        }
        result += measureDistance(offset1, length1, category1, offset2, length2, category2);
        pos = Math.min(offset1 + length1, offset2 + length2);
      }
    }
  }

  result *= 2;
  result /= R * (R - 1) * L * L;
  return result;
}

export function expectedCategoryDisagreement(study, category) {
  const { B, L, R } = study;

  let N_c = 0;
  let squaredLengths = 0;
  for (const u of study.units) {
    if (u.category === category) {
      N_c++;
      squaredLengths += u.length * (u.length - 1);
    }
  }

  // All gap lengths for this category across all raters, sorted descending.
  const gaps = [];
  for (let r = 0; r < R; r++) {
    const ur = raterCategoryUnits(study, r, category);
    let p = 0;
    let nextUnit = p < ur.length ? ur[p++] : null;
    let offset = B;
    let length = 0;
    let pos = B;
    while (pos < B + L) {
      if (pos === offset + length) {
        if (nextUnit !== null && pos === nextUnit.offset) {
          length = nextUnit.length;
          nextUnit = p < ur.length ? ur[p++] : null;
        } else {
          length = (nextUnit !== null ? nextUnit.offset : B + L) - pos;
          gaps.push(length);
        }
        offset = pos;
      }
      pos = offset + length;
    }
  }
  gaps.sort((a, b) => b - a);

  let total = 0;
  for (const u of study.units) {
    if (u.category !== category) continue;
    const l = u.length;
    const sum1 = ((N_c - 1) * (2 * l * l * l - 3 * l * l + l)) / 3;
    let sum2 = 0;
    for (const g of gaps) {
      if (g >= l) sum2 += g - l + 1;
      else break;
    }
    sum2 *= l * l;
    total += sum1 + sum2;
  }

  const denom = R * L * (R * L - 1) - squaredLengths;
  return ((total * 2) / L) / denom;
}

export function alphaUCategory(study, category) {
  const Do = observedCategoryDisagreement(study, category);
  const De = expectedCategoryDisagreement(study, category);
  if (Do === De) return 0;
  if (De === 0) return null;
  return 1 - Do / De;
}

export function alphaUOverall(study) {
  const categories = [...new Set(study.units.map((u) => u.category))].filter((c) => c != null);
  if (categories.length === 0) return null;
  let sumDo = 0;
  let sumDe = 0;
  for (const c of categories) {
    sumDo += observedCategoryDisagreement(study, c);
    sumDe += expectedCategoryDisagreement(study, c);
  }
  const Do = sumDo / categories.length;
  const De = sumDe / categories.length;
  if (Do === De) return 0;
  if (De === 0) return null;
  return 1 - Do / De;
}
