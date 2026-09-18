/**
 * valueSources.js — the one place that knows the shape of the Fisch feed.
 *
 * 📅 2026-09-15. Rewritten from the MM2 version. The exported API is
 * deliberately unchanged, because fourteen files import from here; only the
 * internals know the data underneath is different.
 *
 * ── What changed from MM2 ─────────────────────────────────────────────────
 *
 * MM2 carried TWO catalogues (mm2values + supremevalues) that disagreed on 70%
 * of shared prices, and that disagreement was the product feature. Fisch has
 * ONE catalogue, so there is no second opinion to reconcile — no name
 * normalisation table, no cross-source art fallback, no 787-item merge.
 *
 * What replaces the source toggle is a SCALE toggle, and the distinction is
 * not cosmetic:
 *
 *   VALUE  the community S$ figure. Comparable, summable, what traders quote.
 *   PROTO  an older ordinal scale predating S$ pricing. Its numbers are orders
 *          of magnitude smaller and mean something only next to other Proto
 *          numbers.
 *
 * So a total must stay on ONE scale for a whole trade, and `priceOf` never
 * falls back between them. Quoting a Proto figure as S$ is the named Fisch
 * trading scam; an item unpriced on the selected scale says so instead.
 *
 * ── Fish are deliberately not priced here ─────────────────────────────────
 *
 * A fish's worth is exact arithmetic the game itself publishes
 * (base_value / base_weight × weight × mutations, verified against all 1,659),
 * not community consensus. That lives in Code/Helper/fischValue.js. Laying a
 * consensus number over one the game computes would only make it worse.
 */

import { GAME, imageUrl, ITEM_FILTERS } from '../config/game';

// ── Sources ────────────────────────────────────────────────────────────────

export const VALUE_SOURCE = {
  VALUE: 'value',
  PROTO: 'proto',
};

/** S$ is what traders quote; Proto is the legacy ordinal scale. */
export const DEFAULT_VALUE_SOURCE = VALUE_SOURCE.VALUE;

const SOURCE_LABEL = {
  [VALUE_SOURCE.VALUE]: 'S$',
  [VALUE_SOURCE.PROTO]: 'Proto',
};

export const sourceLabel = (source) =>
  SOURCE_LABEL[source] || SOURCE_LABEL[DEFAULT_VALUE_SOURCE];

// ── Feed shape ─────────────────────────────────────────────────────────────

/**
 * The pipeline publishes `{ meta, data }`; an older raw upload published the
 * collections at the top level. Accept either, so a CDN rollback does not need
 * an app release. No collection is named `meta` or `data`, so the wrapper
 * signature cannot collide with real content.
 */
export const unwrapFeed = (raw) =>
  raw && typeof raw === 'object' && raw.meta && raw.data && typeof raw.data === 'object'
    ? raw.data
    : raw;

/**
 * `generatedAt` is when the SCRAPER ran — not when the app fetched. The
 * difference is the point: showing fetch time makes a month-old catalogue look
 * fresh, which is exactly what players already distrust about value sites.
 */
export const feedMeta = (raw) =>
  raw && typeof raw === 'object' && raw.meta && typeof raw.meta === 'object'
    ? raw.meta
    : null;

export const newestGeneratedAt = (...raws) => {
  let newest = null;
  for (const raw of raws) {
    const at = feedMeta(raw)?.generatedAt;
    if (!at) continue;
    const d = new Date(at);
    if (!Number.isNaN(d.getTime()) && (!newest || d > newest)) newest = d;
  }
  return newest;
};

/** The measured recurring-event schedule the feed carries (Admin Abuse etc). */
export const feedSchedule = (raw) => feedMeta(raw)?.schedule || null;

// ── Names ──────────────────────────────────────────────────────────────────

const normalizeName = (name) =>
  String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const __testing = { normalizeName };

// ── Images ─────────────────────────────────────────────────────────────────
//
// Every row carries a RELATIVE path (`rods/onirifalx.webp`); the host lives
// only in config/game.js. mm2values hardcoded its CDN in nine files and could
// not be re-pointed without a release — this is the fix for that.
//
// A row with no art has `image: null`, which is a real state rather than an
// error: 24 items simply have no file on the wiki. Returning '' lets callers
// fall back to their empty state instead of requesting a 404.

/**
 * Returns `undefined`, never `''`, when a row has no art.
 *
 * Six rows in the live feed carry no image (one rod, one boat, one skin, two
 * mutations, one effect). Every render site spreads this straight into
 * `source={{ uri }}`, and React Native warns "source.uri should not be an
 * empty string" on '' while accepting undefined silently. The three sites that
 * fall back to GAME.defaultAvatar still do — `undefined || x` is `x`.
 */
export const resolveItemImage = (item) => (item ? imageUrl(item.image) || undefined : undefined);

// The MM2 build cross-indexed one catalogue's art into the other. With a single
// catalogue there is nothing to index, but GlobelStats still calls these on
// every refresh, so they stay as no-ops rather than becoming a crash.
export const indexMM2Images = () => 0;
export const getMM2ImageIndexSize = () => 0;
export const indexSupremePrices = () => 0;
export const getSupremePriceIndexSize = () => 0;

// ── Confidence ─────────────────────────────────────────────────────────────

export const VALUE_CONFIDENCE = {
  OBSERVED: 'observed',
  // Computed from the game's own numbers rather than quoted by anyone. Fish
  // values are DERIVED: exact arithmetic, but reported at average weight.
  DERIVED: 'derived',
  MODELED: 'modeled',
  NONE: 'none',
};

export const UNPRICED_REASON = {
  // "Nobody quotes this category", NOT "the game forbids trading it". Rods,
  // baits, mutations and the rest are all tradeable in-game; the community
  // value sites simply only cover cosmetics. Measured on the live feed: all
  // 666 community prices sit in boats (221), skins (379), bobbers (31),
  // lanterns (18) and gliders (17). Rods have exactly one — Darkheart.
  // The old label read "Not tradeable", which told a rod owner something
  // false about their own item.
  NOT_COVERED: 'not_covered',
  EXACT_MATH: 'exact_math',
  NO_QUOTE: 'no_quote',
  SCALE_MISSING: 'scale_missing',
  UNKNOWN: 'unknown',
};

const UNPRICED_LABEL = {
  [UNPRICED_REASON.NOT_COVERED]: 'No value listed',
  [UNPRICED_REASON.EXACT_MATH]: 'Value from weight',
  [UNPRICED_REASON.NO_QUOTE]: 'No quote',
  [UNPRICED_REASON.SCALE_MISSING]: 'Not priced on this scale',
  [UNPRICED_REASON.UNKNOWN]: 'Unpriced',
};

export const unpricedLabelFor = (reason, source = DEFAULT_VALUE_SOURCE) => {
  // SCALE_MISSING means the item IS priced — on the other scale. Measured on
  // the live feed, 207 items (mostly skins: 350 carry Proto against 212 with
  // S$) are in exactly this state, and on the default S$ scale they read as
  // valueless. Naming the scale that does have a figure turns a dead end into
  // "flip the toggle".
  //
  // It deliberately does NOT print the other scale's NUMBER. Quoting a Proto
  // figure where S$ is expected is the named Fisch scam — the two run 50x to
  // 283,333x apart — so the app points at the scale and lets the user switch.
  if (reason === UNPRICED_REASON.SCALE_MISSING) {
    const other = source === VALUE_SOURCE.PROTO ? VALUE_SOURCE.VALUE : VALUE_SOURCE.PROTO;
    return `${SOURCE_LABEL[other]} only`;
  }
  return UNPRICED_LABEL[reason] || UNPRICED_LABEL[UNPRICED_REASON.UNKNOWN];
};

/** Why an item has no usable figure. Naming the reason beats a bare 0. */
export const unpricedReason = (item, source = DEFAULT_VALUE_SOURCE) => {
  if (!item) return UNPRICED_REASON.UNKNOWN;
  if (item.collection === 'fish') return UNPRICED_REASON.EXACT_MATH;
  // An item in an uncovered collection can still carry a quote — Darkheart is
  // a rod with a real S$ figure — so check for one before writing the category
  // off. Only fall back to the category verdict when there is genuinely nothing.
  // "Nobody quotes this" is about PRICING, not about whether the game allows a
  // trade — those are different lists now. See Code/config/game.js.
  if (item.collection && !GAME.communityPriced.includes(item.collection) && !item.trade) {
    return UNPRICED_REASON.NOT_COVERED;
  }
  if (!item.trade) return UNPRICED_REASON.NO_QUOTE;
  // Priced on one scale but not the other is common and real: 519 of 1,279
  // quoted items carry only one of the two figures.
  return item.trade[source] == null
    ? UNPRICED_REASON.SCALE_MISSING
    : UNPRICED_REASON.UNKNOWN;
};

// ── Prices ─────────────────────────────────────────────────────────────────

const formatValue = (n, source) => {
  if (!Number.isFinite(n)) return '';
  if (source === VALUE_SOURCE.PROTO) return n.toLocaleString('en-US');
  if (n >= 1e9) return `${(n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1)}K`;
  return n.toLocaleString('en-US');
};

/**
 * The figure for one item on one scale.
 *
 * Never falls back between scales. A Proto number reported as S$ is out by
 * three to four orders of magnitude, and that confusion is the exact scam this
 * screen exists to prevent — so an item unpriced on the selected scale returns
 * `missing` with a reason rather than the other scale's number.
 */
export const priceOf = (item, source = DEFAULT_VALUE_SOURCE) => {
  const empty = { value: 0, valueConfidence: VALUE_CONFIDENCE.NONE, valueText: '', missing: false };
  if (!item) return empty;

  // Items embedded in older chat/trade documents store the figure inline, and
  // they must keep rendering — those documents are not going to be rewritten.
  const inline = item.selectedValue ?? item.Value;
  if (item.trade == null && Number.isFinite(Number(inline)) && Number(inline) > 0) {
    const n = Number(inline);
    return {
      value: n,
      valueConfidence: VALUE_CONFIDENCE.OBSERVED,
      valueText: formatValue(n, source),
      missing: false,
    };
  }

  // Fish are priced by the GAME, not by consensus, so they never carry a
  // community quote — and were therefore showing as unpriced across the whole
  // app. That was 1,659 of 3,950 listed items reading "no value" in a values
  // app. `avg_value` is the catalogue's own figure at the fish's average
  // weight, and our formula reproduces it exactly (see Code/Helper/fischValue.js),
  // so it is a real number, not an estimate of one.
  //
  // It is still an AVERAGE: a specific catch is worth
  // base_value / base_weight x its actual weight, which the Fish Value screen
  // computes. Hence DERIVED rather than OBSERVED, so the UI can label it.
  if (item.collection === 'fish') {
    const avg = Number(item.avg_value);
    if (Number.isFinite(avg) && avg > 0) {
      return {
        value: avg,
        valueConfidence: VALUE_CONFIDENCE.DERIVED,
        valueText: formatValue(avg, source),
        missing: false,
        isAverage: true,
      };
    }
  }

  const n = Number(item.trade?.[source]);
  if (!Number.isFinite(n) || n <= 0) {
    return {
      ...empty,
      missing: true,
      reason: unpricedReason(item, source),
      demand: item.trade?.demand || null,
      quotedAgo: item.trade?.quotedAgo || null,
    };
  }

  return {
    value: n,
    valueConfidence: VALUE_CONFIDENCE.OBSERVED,
    valueText: formatValue(n, source),
    missing: false,
    demand: item.trade?.demand || null,
    trend: item.trade?.trend || null,
    // How stale the quote is. Across the catalogue this ranges from 1 day to
    // 7 months, so hiding it would present old numbers as current.
    quotedAgo: item.trade?.quotedAgo || null,
  };
};

/** Whether an item may legitimately enter a total on this scale. */
export const isSummable = (item, source = DEFAULT_VALUE_SOURCE) => {
  if (!item) return false;
  // Proto is ordinal. Summing ranks yields a number that looks like money and
  // means nothing, so Proto is for comparison only, never for totals.
  if (source === VALUE_SOURCE.PROTO) return false;
  // A fish's value is in-game C$; a community quote is S$. They are different
  // units, so adding them produces a number that looks like money and is not.
  // Fish still DISPLAY their value — they are just not summed into an S$ total.
  if (item.collection === 'fish') return false;
  return !priceOf(item, source).missing;
};

/**
 * The original cost of an item, for the case where nobody has priced it.
 *
 * This is the one thing we hold that no value site publishes: the wiki records
 * what a cosmetic originally sold for and, for a few, how many were ever made.
 * It is NOT a trade value and must never be presented as one — see
 * _research/FISCH-VALUE-RATIONALISATION.md, where a model built from exactly
 * this data missed real values by a median factor of 3x. It is context a trader
 * can reason from, nothing more.
 *
 * Only 136 of 740 unpriced cosmetics have one, so this returns null far more
 * often than not. Fields must be tested for a VALUE: this feed carries plenty
 * of present-but-null keys.
 */
export const supplyNote = (item) => {
  if (!item) return null;
  const val = (v) => (v == null || v === '' ? null : v);
  // Skins record `robux` as a number; the other collections carry `price` as a
  // pre-formatted string like "R$799".
  const raw = val(item.robux) ?? val(item.price) ?? val(item.priceValue);
  if (raw == null) return null;

  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;

  const parts = [`R$${n.toLocaleString('en-US')}`];
  const stock = Number(String(val(item.stock) ?? '').replace(/[^0-9.]/g, ''));
  if (Number.isFinite(stock) && stock > 0) {
    parts.push(`${stock.toLocaleString('en-US')} made`);
  } else if (String(item.obtain || '').toLowerCase() === 'limited') {
    parts.push('limited');
  }
  return parts.join(' · ');
};

export const displayValueText = (item, source = DEFAULT_VALUE_SOURCE) => {
  const p = priceOf(item, source);
  if (p.missing) return unpricedLabelFor(p.reason, source);
  // Fish are quoted in the game's own currency at average weight, so they must
  // not wear the S$ prefix — that would claim a community consensus that does
  // not exist, and invite adding them to an S$ total.
  if (p.isAverage) return `C$ ${p.valueText} avg`;
  return source === VALUE_SOURCE.PROTO ? p.valueText : `S$ ${p.valueText}`;
};

/**
 * Totals for a list, plus what had to be left out and why.
 *
 * The trade grid is a FIXED-LENGTH array of slots — nine per side — so most
 * entries are `null` until the user fills them. An empty slot is not an
 * unpriced item, and counting it as one made a completely empty side report
 * "9 items Unpriced". Skip the holes; `count` is items, not slots.
 */
export const summarizeItems = (items, source = DEFAULT_VALUE_SOURCE) => {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  let total = 0, observed = 0, modeled = 0, unpriced = 0;
  let cashTotal = 0, cashCount = 0;

  for (const item of list) {
    const p = priceOf(item, source);
    if (p.missing) { unpriced++; continue; }
    if (!isSummable(item, source)) {
      modeled++;
      // A fish is NOT unpriced — it carries a real figure, in C$, the game's
      // own currency. It cannot join an S$ total (different units, and the
      // Scrip Vendor's one-way C$100,000 -> S$1 sink would value every fish at
      // roughly zero), but silently dropping it is what made the calculator
      // read 0 after a user added a fish and reasonably expected a number.
      // So it gets its own running total, reported alongside rather than
      // folded in.
      if (item.collection === 'fish') { cashTotal += p.value; cashCount++; }
      continue;
    }
    total += p.value;
    observed++;
  }
  return {
    total, observed, modeled, unpriced,
    count: list.length,
    totalText: formatValue(total, source),
    // Items that HAVE a figure but cannot join the total, excluding fish
    // (which get their own C$ line). On the Proto scale this is everything:
    // Proto is an ordinal rank, so summing it is meaningless by design. These
    // must not be reported as "unpriced" — they are priced, just not addable.
    notSummable: Math.max(0, modeled - cashCount),
    // Always formatted on the VALUE scale: C$ is a currency with real
    // magnitudes, so it wants K/M grouping even when the toggle says Proto.
    cashTotal, cashCount,
    cashTotalText: cashTotal > 0 ? `C$ ${formatValue(cashTotal, VALUE_SOURCE.VALUE)}` : '',
  };
};

// ── Item pool ──────────────────────────────────────────────────────────────

/**
 * One flat, searchable list across every collection.
 *
 * Fisch's feed is `{ collectionName: [rows] }` — a flat array per collection —
 * where MM2's was `{ category: { tier: [items] } }`. Rows are tagged with the
 * collection they came from, because almost every downstream decision (is this
 * tradeable, is it priced by arithmetic, which screen owns it) depends on it.
 *
 * The second argument is ignored. Six call sites still pass MM2's secondary
 * feed, and changing them all buys nothing.
 */
export const buildItemPool = (data /* , _secondary */) => {
  const feed = unwrapFeed(data);
  if (!feed || typeof feed !== 'object') return [];

  const pool = new Map();
  for (const [collection, rows] of Object.entries(feed)) {
    if (!Array.isArray(rows)) continue;
    // Reference data has no tab and cannot be held — see FILTERABLE above.
    if (!FILTERABLE.has(collection.toLowerCase())) continue;
    for (const row of rows) {
      if (!row || !row.name) continue;
      // page_id is the only guaranteed-unique field. Names genuinely repeat —
      // two NPCs called Witch, "Lucky" and "Lucky+" — so keying on name alone
      // would silently drop rows.
      const key = row.page_id != null
        ? `${collection}:${row.page_id}`
        : `${collection}:${normalizeName(row.name)}`;
      if (pool.has(key)) continue;
      pool.set(key, { ...row, collection, valueSource: DEFAULT_VALUE_SOURCE });
    }
  }
  return [...pool.values()];
};

/**
 * Does an item belong to a filter tab?
 *
 * The two ends that have to agree: filter labels are UPPERCASE ('RODS'), and
 * buildItemPool tags every row with its lowercase feed collection ('rods').
 * This is the only place that knows that, so it lives next to the tagger.
 *
 * MM2 matched `item.Category` / `item.type` — fields no Fisch row carries — so
 * every tab except ALL came back empty while looking perfectly functional.
 * INVENTORY is the user's own list, filtered before it reaches here.
 */
/**
 * Collections that have a filter tab, and therefore a home in the UI.
 *
 * The feed carries 18 collections but only 14 are things you can hold: `npcs`
 * are shopkeepers, `versions` are changelog entries, `events` are calendar
 * rows. Left in, 1,111 of those sat under ALL in a TRADE CALCULATOR, where
 * "Update v1.4.2" is offerable and reachable by search. Deriving the set from
 * ITEM_FILTERS means adding a tab is the only step needed to surface a new
 * collection — the two cannot drift apart.
 */
const FILTERABLE = new Set(
  ITEM_FILTERS.filter((f) => f !== 'ALL').map((f) => f.toLowerCase()),
);

export const matchesFilter = (item, filter) => {
  if (!item) return false;
  const f = String(filter || '').toUpperCase();
  if (!f || f === 'ALL' || f === 'INVENTORY') return true;
  return String(item.collection || '').toUpperCase() === f;
};

/**
 * Stable, unique identity for a catalogue row — use this for every keyExtractor.
 *
 * NO row in the Fisch feed has an `id`, and 121 names are shared by 255 rows
 * (four NPCs called Nico, three Bananas, "Lucky" and "Lucky+"). `item.id ||
 * item.name` therefore handed FlatList duplicate keys, which breaks React's
 * reconciliation and makes a long list thrash on every re-render.
 *
 * This is the same `collection:page_id` identity buildItemPool already uses to
 * dedupe the pool, so keys and dedupe can never disagree.
 */
export const itemKey = (item, index = 0) => {
  if (!item) return `idx-${index}`;
  if (item.id != null) return String(item.id);
  const c = item.collection || 'x';
  if (item.page_id != null) return `${c}:${item.page_id}`;
  return `${c}:${normalizeName(item.name || '')}:${index}`;
};

/** Which scale a list of items was priced on. */
export const sourceLabelForItems = (items) => {
  const found = Array.isArray(items) ? items.find((i) => i && i.valueSource) : null;
  return sourceLabel(found?.valueSource);
};
