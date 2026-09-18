/**
 * fischValue.js — what a fish is actually worth.
 *
 * This is NOT a community estimate. It is the game's own arithmetic, taken from
 * the wiki's calculator (MediaWiki:FischTools.js, `calculateFishValue`) and
 * re-validated against the live catalogue:
 *
 *   value = ceil( ceil(base_value / base_weight * weight) * Π mutationMultipliers )
 *
 * Computing each fish's value at its average weight reproduces the catalogue's
 * own `avg_value` for 1,650 of 1,659 fish; the nine that "differ" are the
 * catalogue rounding to one decimal (33.2 vs 33.15), not real misses.
 *
 * Ported from _pipeline/lib/fisch-value.js. Keep the two in step — the pipeline
 * is what proves the formula against the whole catalogue, this is what the app
 * shows a player holding one fish.
 *
 * ── The field-name trap ────────────────────────────────────────────────────
 *
 * The wiki's calculator calls the divisor `max_weight`. In the Bucket tables
 * that same number is `base_weight`. They are the same quantity — verified
 * identical on all 1,111 fish present in both sources — and `base_weight` is
 * NOT a minimum or a typical weight. Dividing by the wrong field silently
 * yields plausible-looking wrong prices, which is the worst failure mode a
 * value app has.
 *
 *   max_weight == base_weight                  (1111/1111)
 *   min_weight == base_weight - weight_range   (1111/1111)
 *   avg_weight == (min + max) / 2
 *
 * ── Why multipliers come from the catalogue, not constants ────────────────
 *
 * Shiny and Sparkling are ×1.85 each, but they are not special cases: they are
 * ordinary rows in the Mutations collection with `value: [1.85]`. Reading every
 * multiplier from that collection means a new mutation ships with the next data
 * build instead of needing an app release.
 */

/** Multipliers keyed by mutation name, built from the `mutations` collection. */
export const mutationTable = (mutations) => {
  const table = {};
  for (const m of mutations || []) {
    if (!m?.name) continue;
    // `value` is a repeated wiki field, so it arrives as an array even when single.
    const v = Array.isArray(m.value) ? m.value[0] : m.value;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) table[m.name] = n;
  }
  return table;
};

/**
 * @param {object} fish      a row from the `fish` collection
 * @param {number} weight    the caught weight in kg
 * @param {string[]} mutations  names on this catch, e.g. ['Shiny','Midas']
 * @param {object} table     from mutationTable()
 * @returns {{value:number|null, perKg:number|null, applied:object, unknown:string[]}}
 */
export const fishValue = (fish, weight, mutations = [], table = {}) => {
  const base = Number(fish?.base_value);
  const div = Number(fish?.base_weight);
  const kg = Number(weight);

  // An unpriced or zero-weight fish must return null, never 0 — a 0 silently
  // drops out of a total and reads as "worthless" rather than "unknown".
  if (
    !Number.isFinite(base) || !Number.isFinite(div) || div <= 0 ||
    !Number.isFinite(kg) || kg <= 0
  ) {
    return { value: null, perKg: null, applied: {}, unknown: [] };
  }

  const perKg = base / div;
  let value = Math.ceil(perKg * kg); // inner ceil, BEFORE multipliers

  const applied = {};
  const unknown = [];
  for (const name of mutations) {
    const mult = table[name];
    if (mult === undefined) { unknown.push(name); continue; }
    applied[name] = mult;
    value *= mult;
  }

  return { value: Math.ceil(value), perKg, applied, unknown }; // outer ceil, AFTER
};

/** Weight bounds for a fish, derived rather than stored. */
export const weightRange = (fish) => {
  const max = Number(fish?.base_weight);
  const span = Number(fish?.weight_range);
  if (!Number.isFinite(max)) return null;
  const min = Number.isFinite(span) ? max - span : max;
  return { min, max, avg: (min + max) / 2 };
};

/** Compact display for the large numbers this produces (1.2M, 15K). */
export const formatFishValue = (n) => {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1)}K`;
  return Math.round(n).toLocaleString('en-US');
};

export default { fishValue, mutationTable, weightRange, formatFishValue };
