/** Shared helpers for rubric functions. Kept tiny and dependency-free on purpose. */

/** Bound a value to [lo, hi]. NaN collapses to the floor rather than propagating. */
export function clamp(value: number, lo = 0, hi = 1): number {
  if (Number.isNaN(value)) return lo;
  return Math.min(hi, Math.max(lo, value));
}

/** Booleans contribute 1 or 0 to a weighted sum. */
export function b(value: boolean): number {
  return value ? 1 : 0;
}

/**
 * Decimal places a rubric result is defined to.
 *
 * Six is far beyond anything a 0-100 score can express, so it never changes a
 * displayed number -- it exists to remove binary floating-point dust.
 */
const RESULT_PRECISION = 6;
const RESULT_SCALE = 10 ** RESULT_PRECISION;

/**
 * Finalise a rubric result: clamp to [0,1], then round to a defined precision.
 *
 * The rounding is not cosmetic. Weights that are exact in decimal are not exact
 * in binary, so a genuinely perfect category sums to 0.9999999999999999 rather
 * than 1. Persisting that leaves dust in stored scores and in the version-to-
 * version comparisons the product is built around -- two identical resumes could
 * differ in the sixteenth decimal place and a naive equality check would call
 * that a change.
 *
 * Rounding here, at the single boundary where a rubric produces its answer,
 * means every stored score is exact at the precision it claims.
 */
export function finalize(value: number): number {
  return Math.round(clamp(value) * RESULT_SCALE) / RESULT_SCALE;
}
