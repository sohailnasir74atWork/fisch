import { imageUrl, ITEM_FILTERS, GAME } from '../config/game';
import {
  normalizeScale, unitFor, stableItemId, parseStored, marketQuote,
  summarizeMarket, evaluateTrade, listingKind, quantityOf, canTrade, resolveItem, quoteAgeDays,
} from './feedContract';

export { canTrade, resolveItem, normalizeScale, evaluateTrade, listingKind };
export const VALUE_SOURCE = { VALUE: 'value', PROTO: 'proto' };
export const DEFAULT_VALUE_SOURCE = VALUE_SOURCE.VALUE;
export const sourceLabel = unitFor;
export const unwrapFeed = raw => { const f = parseStored(raw); return f?.meta && f?.data ? f.data : f; };
export const feedMeta = raw => parseStored(raw)?.meta || null;
export const feedSchedule = raw => feedMeta(raw)?.schedule || null;
export const newestGeneratedAt = (...raws) => {
  const dates = raws.map(raw => Date.parse(feedMeta(raw)?.generatedAt)).filter(Number.isFinite);
  return dates.length ? new Date(Math.max(...dates)) : null;
};
export const resolveItemImage = item => item ? imageUrl(item.image || item.imageUrl || item.Image) || undefined : undefined;
export const indexMM2Images = () => 0;
export const getMM2ImageIndexSize = () => 0;
export const indexSupremePrices = () => 0;
export const getSupremePriceIndexSize = () => 0;
export const VALUE_CONFIDENCE = { OBSERVED: 'observed', DERIVED: 'derived', MODELED: 'modeled', NONE: 'none' };
export const UNPRICED_REASON = { NOT_COVERED: 'not_tradeable', EXACT_MATH: 'catch_details', NO_QUOTE: 'no_quote', SCALE_MISSING: 'scale_missing', UNKNOWN: 'unknown' };
export const unpricedLabelFor = reason => ({
  not_tradeable: 'Not tradeable', catch_details: 'Add catch details', variant_missing: 'No quote',
  unverified_quote: 'No quote', no_quote: 'No quote', scale_missing: 'No quote',
}[reason] || 'Unpriced');
export const unpricedReason = (item, source) => marketQuote(item, source).reason;
const compactMarketFormat = new Intl.NumberFormat('en-US', {
  notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 2,
});
const preciseMarketFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 });
export const formatMarketValue = n => Number.isFinite(n)
  ? (Math.abs(n) >= 1000 ? compactMarketFormat : preciseMarketFormat).format(n) : '—';
// Catalogue preview only: a base fish quote is not a valuation of a selected catch.
export const pickerQuote = (item, scale = DEFAULT_VALUE_SOURCE) => {
  scale = normalizeScale(scale);
  if (item?.collection !== 'fish' || item.catch) return marketQuote(item, scale);
  const trade = item.trade;
  const value = trade?.[scale];
  if (!canTrade(item) || trade?.itemCategory !== 'fish' || !Number.isFinite(value) || value < 0)
    return { missing: true, value: null };
  const age = quoteAgeDays(trade);
  return { missing: false, value, base: true, stale: age == null || age > 90 };
};
export const pickerValueText = (item, scale = DEFAULT_VALUE_SOURCE) => {
  scale = normalizeScale(scale);
  const quote = pickerQuote(item, scale);
  if (!quote.missing) return (quote.base ? 'Base ' : '') + sourceLabel(scale) + ' ' +
    formatMarketValue(quote.value) + (quote.stale ? ' · stale' : '');
  return 'No quote';
};
export const priceOf = (item, source = DEFAULT_VALUE_SOURCE) => {
  const quote = marketQuote(item, source);
  return { ...quote, valueText: quote.missing ? '' : formatMarketValue(quote.value),
    valueConfidence: quote.missing ? VALUE_CONFIDENCE.NONE : VALUE_CONFIDENCE.OBSERVED };
};
export const isSummable = (item, source) => !marketQuote(item, source).missing;
export const displayValueText = (item, source = DEFAULT_VALUE_SOURCE) => {
  const p = priceOf(item, source);
  return p.missing ? unpricedLabelFor(p.reason) : sourceLabel(source) + ' ' + p.valueText + (p.stale ? ' · stale' : '');
};
// Original acquisition cost is context only; preserve its actual currency.
export const supplyNote = item => {
  if (!item) return null;
  const raw = item.robux != null ? 'R$' + item.robux : item.price || item.priceValue;
  return raw == null || raw === '' ? null : 'Original cost: ' + String(raw);
};
export const summarizeItems = (items, source = DEFAULT_VALUE_SOURCE) => {
  const s = summarizeMarket(items, source);
  return { ...s, totalText: formatMarketValue(s.total), modeled: 0, notSummable: 0, cashCount: 0, cashTotal: 0, cashTotalText: '' };
};
const FILTERABLE = new Set(ITEM_FILTERS.filter(f => f !== 'ALL').map(f => f.toLowerCase()));
export const buildItemPool = raw => {
  const data = unwrapFeed(raw), result = new Map();
  for (const [collection, rows] of Object.entries(data || {})) {
    if (!FILTERABLE.has(collection) || !Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row?.name) continue;
      const item = { ...row, collection };
      item.itemId = stableItemId(item);
      if (!result.has(item.itemId)) result.set(item.itemId, item);
    }
  }
  return [...result.values()];
};
export const matchesFilter = (item, filter) => !!item &&
  (!filter || ['ALL','INVENTORY'].includes(String(filter).toUpperCase()) ||
    item.collection?.toUpperCase() === String(filter).toUpperCase());
export const itemKey = (item, index = 0) => stableItemId(item) || 'unknown-' + index;
export const sourceLabelForItems = items => sourceLabel(items?.find(i => i?.valueSource)?.valueSource);
export const __testing = { normalizeName: s => String(s || '').normalize('NFKC').toLowerCase().trim() };

export const catchDescription = item => item?.catch
  ? [item.catch.weightKg + ' kg', item.catch.mutation, ...(item.catch.attributes || []), quantityOf(item) > 1 ? '×' + quantityOf(item) : null].filter(Boolean).join(' · ')
  : quantityOf(item) > 1 ? '×' + quantityOf(item) : '';
export const serializeTradeItem = (item, scale = DEFAULT_VALUE_SOURCE) => {
  const quote = priceOf(item, scale);
  return {
    itemId: stableItemId(item), name: item.name || item.Name || '', collection: item.collection || '',
    type: item.collection || '', quantity: quantityOf(item), image: resolveItemImage(item) || '',
    imageSource: item.imageSource || null, imageOriginalUrl: item.imageOriginalUrl || null,
    catch: item.catch || null, npcEstimate: item.npcEstimate || null,
    trade: item.trade || null, tradeability: item.tradeability || { allowed: canTrade(item) },
    value: quote.value, valueSource: normalizeScale(scale), unit: sourceLabel(scale),
    quote, valueConfidence: quote.valueConfidence, valueText: quote.valueText || null,
  };
};
export const createTradeSnapshot = (give, receive, scale, now = Date.now()) => {
  scale = normalizeScale(scale);
  const has = summarizeMarket(give, scale, now), wants = summarizeMarket(receive, scale, now);
  const evaluation = evaluateTrade(has, wants, GAME.trade.fairBandPercent);
  return { version: 2, capturedAt: new Date(now).toISOString(), scale, unit: sourceLabel(scale),
    has, wants, evaluation, kind: listingKind([...give, ...receive]) };
};
export const savedTradeSnapshot = trade => {
  const snapshot = trade?.valuation;
  if (snapshot?.version !== 2 || !snapshot.has || !snapshot.wants || !snapshot.evaluation ||
      snapshot.unit !== sourceLabel(snapshot.scale)) return null;
  return snapshot;
};
