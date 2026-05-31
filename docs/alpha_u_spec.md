# Krippendorff's unitizing alpha (αU): locked formula and validation fixture

This is the research-and-pin document for adding αU. It captures the exact
algorithm and the published worked examples we will validate against, **before**
any production code. Implementation comes next, tested against the fixtures here.

## Sources

- Krippendorff, K. (1995). On the reliability of unitizing continuous data.
  *Sociological Methodology* 25:47–76. (the original αU)
- Krippendorff, K. (2004). *Content Analysis: An Introduction to Its Methodology*
  (2nd ed.), pp. 253–254. (the corrected expected-disagreement formula)
- Reference implementation: DKPro Agreement (UKP Lab, Apache-2.0),
  `KrippendorffAlphaUnitizingAgreement.java`, whose unit tests reproduce the two
  examples above. We use it only to confirm the algorithm; our implementation
  will be independent JS. The math is Krippendorff's.

## Data model

- A continuum `[B, B+L)` (begin `B`, length `L`). For our tool, this is the
  common window across coders, and `L = commonLength`.
- `R` raters (coders). Categories = codes.
- A **unit** = a coder's coded segment for a category: `{ offset, length, rater, category }`.
  Regions a coder did not code for a category are **gaps** (category = null),
  filled in implicitly between that coder's units.
- Constraint: a single coder's units for the **same** category may not overlap
  each other. (Implementation note: merge any overlapping same-code segments per
  coder before computing αU.)

Our existing parse already yields, per coder per code, segments `[start, end)`;
map each to `offset = start - B`, `length = end - start`, `category = code`.

## The distance function (pinned by unit tests)

For two units `(o1, l1, c1)` and `(o2, l2, c2)` let `beginDiff = o1 - o2` and
`lengthDiff = l1 - l2`. Note `beginDiff + lengthDiff = (o1+l1) - (o2+l2)` is the
difference of the segment ends.

```
measureDistance(o1, l1, c1, o2, l2, c2):
  beginDiff  = o1 - o2
  lengthDiff = l1 - l2
  if c1 != null and c2 != null and (-l1 < beginDiff < l2):      # both coded, overlapping
      return beginDiff^2 + (beginDiff + lengthDiff)^2           #   = (Δstart)^2 + (Δend)^2
  elif c1 != null and c2 == null and (-lengthDiff >= beginDiff >= 0):  # unit1 inside gap2
      return l1^2
  elif c1 == null and c2 != null and (-lengthDiff <= beginDiff <= 0):  # unit2 inside gap1
      return l2^2
  else:
      return 0
```

Validation (from Krippendorff 2004 test, exact equality):

| call | expected |
|---|---|
| `measureDistance(5,6,"X", 5,6,"X")` | 0 |
| `measureDistance(5,6,"X", 6,4,"X")` | 2 |
| `measureDistance(5,6,"X", 7,2,"X")` | 8 |
| `measureDistance(5,6,"X", 6,2,"X")` | 10 |
| `measureDistance(5,6,"X", 5,2,"X")` | 16 |
| `measureDistance(5,6,"X", 4,2,"X")` | 26 |
| `measureDistance(225,70,"c", 220,80,"c")` | 50 |
| `measureDistance(370,30,"c", 355,20,"c")` | 850 |
| `measureDistance(400,50,null, 400,20,"c")` | 400 |
| `measureDistance(2,3,null, 2,2,"X") + measureDistance(5,6,"X", 4,7,null)` | 40 |

## Observed disagreement for a category `c`

Walk the continuum once per pair of raters, advancing through each rater's
sequence of units and gaps; at each section add the distance between the two
currently-active units.

```
D_o(c):
  result = 0
  for each rater pair (r1, r2):
    # iterate r1's and r2's units (for category c) interleaved with gaps,
    # both starting at B; at each step compute the active (offset,length,category)
    # for each rater, then:
    result += measureDistance(o1, l1, cat1, o2, l2, cat2)
    # advance pos to min(end of active unit1, end of active unit2); whichever
    # unit ends advances to its next unit (or to a gap up to the next unit).
  result *= 2
  result /= R*(R-1) * L^2
  return result
```

(See DKPro `calculateObservedCategoryDisagreement` for the exact cursor loop;
the section walk is the only fiddly part and must be transcribed carefully.)

## Expected disagreement for a category `c`

```
D_e(c):
  N_c = number of units of category c (across all raters)
  squaredLengths = Σ over c-units of length*(length-1)
  gaps = all gap lengths for category c, across all raters, sorted DESCENDING
  total = 0
  for each c-unit with length l:
    sum1 = (N_c - 1) * (2*l^3 - 3*l^2 + l) / 3
    sum2 = ( Σ over gaps g with g >= l of (g - l + 1) ) * l^2
    total += sum1 + sum2
  return (total * 2 / L) / ( R*L*(R*L - 1) - squaredLengths )
```

Use enough numeric care: `R*L*(R*L-1)` can be large (the reference uses
BigDecimal). For our continua (L ~ a few thousand) doubles are fine, but verify.

## αU

```
αU(category) = 1 - D_o(c) / D_e(c)          (0 if D_o == D_e)
αU overall   = 1 - mean_c D_o(c) / mean_c D_e(c)
```

## Validation fixtures (the targets)

### Fixture 1 — Krippendorff (2004), p.254. Primary target.

Continuum `[150, 300)` (L = 150), R = 2. Units (offset, length, rater, category):

```
c: (225,70,0) (370,30,0) (220,80,1) (355,20,1) (400,20,1)
k: (180,60,0) (300,50,0) (180,60,1) (300,50,1)
```

Expected:
- **Overall αU = 0.8591** (±0.0005)
- category "c": D_o = 0.0144, D_e = 0.0532, αU = 0.7286
- category "k": D_o = 0.0000, D_e = 0.0490, αU = 1.0000

### Fixture 2 — distance function

The 10 `measureDistance` rows in the table above (exact equality).

### Fixture 3 — Krippendorff (1995), p.57. Cross-check.

Continuum `[0, 24)` (L = 24), R = 2, categories A/B/C/D (unit lists in DKPro
`Krippendorff1995Test.createExample`). Observed disagreements (continuum-length
independent): A = 0.03125, B = 2.26736, C = 0.02777, D = 0.38715. Expected
disagreement depends on L and converges as the continuum is stretched; at large L,
category C: D_e → 0.08642, αU(C) → 0.679. (Krippendorff's 1995 D_e had a small
error corrected in 2004; match the 2004 formula above, which Fixture 1 anchors.)

## Implementation plan (next turn)

1. `src/kappa/alpha_u.js`: pure functions `measureDistance`, `observedDisagreement`,
   `expectedDisagreement`, `alphaUCategory`, `alphaUOverall`, operating on a
   `{ B, L, R, units: [{offset,length,rater,category}] }` model.
2. `test/alpha_u.test.js`: encode Fixtures 1–3 exactly. Must pass before wiring in.
3. Adapter in `analyze.js`: build the unit model from the existing per-coder,
   per-code segments over the common window; merge overlapping same-code segments
   per coder first.
4. Surface αU overall alongside the pooled kappa, and per-code αU in the table,
   clearly labelled. Decide presentation (companion to kappa, not replacement).

Nothing above is built yet. This document is the locked target.
