/* Shared with FischValues/Code/Helper/feedContract.js. Pure versioned data rules. */
const SCHEMA_VERSION = 2;
const TRADE_COLLECTIONS = ['fish', 'skins', 'boats', 'bobbers', 'lanterns', 'gliders', 'booths', 'halos'];
const normalizeScale = scale => scale === 'proto' ? 'proto' : 'value';
const unitFor = scale => normalizeScale(scale) === 'proto' ? 'Proto' : 'S$';
const nameKey = s => String(s || '').normalize('NFKC').toLowerCase().trim();
const stableItemId = item => {
  if (!item) return null;
  if (item.itemId) return item.itemId;
  const collection = item.collection || item.category || item.type;
  if (collection === 'versions') return 'versions:' + encodeURIComponent(item.version || nameKey(item.name));
  if (collection === 'events') return 'events:' + item.page_id + ':' + encodeURIComponent(nameKey(item.name));
  if (collection === 'npcs') return 'npcs:' + item.page_id + ':' + encodeURIComponent(nameKey(item.name) + ':' + JSON.stringify(item.location || []));
  return collection ? `${collection}:${item.page_id != null ? item.page_id : encodeURIComponent(nameKey(item.name || item.Name))}` : null;
};
const quantityOf = item => Number.isInteger(item?.quantity) && item.quantity > 0 && item.quantity <= 99 ? item.quantity : 1;
const canTrade = item => {
  if (!item || !TRADE_COLLECTIONS.includes(item.collection)) return false;
  if (item.tradeability) return item.tradeability.allowed === true;
  return !/mastery/i.test(String(item.obtain || '') + ' ' + String(item.obtainment || '')) && !/untrad(e)?able|cannot be traded|not trad(e)?able/i.test(item.notes || '');
};
const resolveItem = (pool, saved) => {
  if (!saved) return null;
  const exact = saved.itemId && pool.find(item => item.itemId === saved.itemId);
  if (exact) return { ...exact, ...(saved.catch ? { catch: saved.catch } : {}), quantity: quantityOf(saved) };
  const category = saved.collection || saved.category || saved.type;
  const matches = pool.filter(item => nameKey(item.name) === nameKey(saved.name || saved.Name) && (!category || item.collection === category));
  return matches.length === 1 ? { ...matches[0], ...(saved.catch ? { catch: saved.catch } : {}), quantity: quantityOf(saved) } : null;
};
const parseStored = value => {
  let result = value;
  for (let i = 0; i < 2 && typeof result === 'string'; i++) {
    try { result = JSON.parse(result); } catch { return null; }
  }
  return result && typeof result === 'object' && !Array.isArray(result) ? result : null;
};
function validateFeed(raw, { allowLegacy = true } = {}) {
  const feed = parseStored(raw);
  if (!feed) throw new Error('Feed must be an object');
  const meta = feed.meta || {}, data = feed.data && feed.meta ? feed.data : feed;
  if (meta.game && meta.game !== 'fisch') throw new Error('Feed belongs to another game');
  if (meta.schemaVersion && meta.schemaVersion !== SCHEMA_VERSION) throw new Error('Unsupported feed schema');
  if (!allowLegacy && (meta.schemaVersion !== SCHEMA_VERSION || meta.game !== 'fisch' || !meta.generatedAt || !meta.buildId)) throw new Error('Expected Fisch schema v2');
  for (const key of ['fish', 'skins', 'boats', 'mutations']) if (!Array.isArray(data[key]) || !data[key].length) throw new Error(`Missing collection: ${key}`);
  const ids = new Set();
  for (const [collection, rows] of Object.entries(data)) {
    if (!Array.isArray(rows)) throw new Error(`Invalid collection: ${collection}`);
    for (const row of rows) {
      if (!row || typeof row !== 'object') throw new Error(`Invalid ${collection} row`);
      if (collection !== 'codes' && (typeof row.name !== 'string' || !row.name.trim())) throw new Error(`Unnamed ${collection} item`);
      if (meta.schemaVersion === SCHEMA_VERSION) {
        if (!row.itemId || row.collection !== collection || ids.has(row.itemId)) throw new Error(`Invalid/duplicate identity: ${row.itemId}`);
        ids.add(row.itemId);
        if (row.trade && row.trade.itemCategory !== collection) throw new Error(`Quote category mismatch: ${row.name}`);
      }
      for (const scale of ['value', 'proto']) {
        const n = row.trade?.[scale];
        if (n != null && (typeof n !== 'number' || !Number.isFinite(n) || n < 0)) throw new Error(`Invalid ${scale} quote: ${row.name}`);
      }
    }
  }
  if (meta.generatedAt && !Number.isFinite(Date.parse(meta.generatedAt))) throw new Error('Invalid feed timestamp');
  return { data, meta };
}
function quoteAgeDays(trade, now = Date.now()) {
  if (trade?.quoteUpdatedAt) { const at = Date.parse(trade.quoteUpdatedAt); return Number.isFinite(at) ? Math.max(0, (now - at) / 86400000) : null; }
  const m = String(trade?.quotedAgo || '').match(/([\d.]+)\s*(mo|yr|[smhdwy])/i);
  if (!m) return null;
  const factor = { s: 1/86400, m: 1/1440, h: 1/24, d: 1, w: 7, mo: 30, y: 365, yr: 365 }[m[2].toLowerCase()];
  const elapsed = trade.fetchedAt ? Math.max(0, (now - Date.parse(trade.fetchedAt)) / 86400000) : 0;
  return Number(m[1]) * factor + (Number.isFinite(elapsed) ? elapsed : 0);
}
function marketQuote(item, scale = 'value', now = Date.now()) {
  scale = normalizeScale(scale);
  const empty = { value: null, missing: true, unit: unitFor(scale), scale, stale: false, reason: 'no_quote' };
  if (!canTrade(item)) return { ...empty, reason: 'not_tradeable' };
  const t = item.trade;
  if (!t || t.itemCategory !== item.collection) return { ...empty, reason: 'unverified_quote' };
  let value = t[scale];
  if (item.collection === 'fish') {
    if (!item.catch || !Number.isFinite(item.catch.weightKg) || item.catch.weightKg <= 0) return { ...empty, reason: 'catch_details' };
    if (item.catch.mutation || (item.catch.attributes || []).some(x => !['Shiny', 'Sparkling', 'Big', 'Giant', 'Small', 'Tiny'].includes(x))) return { ...empty, reason: 'variant_missing' };
    const shiny = item.catch.attributes?.includes('Shiny'), sparkling = item.catch.attributes?.includes('Sparkling');
    const variant = shiny && sparkling ? 'shiny_sparkling' : shiny ? 'shiny' : sparkling ? 'sparkling' : 'normal';
    if (variant !== 'normal') value = t.variants?.[variant]?.[scale];
  }
  if (value == null || !Number.isFinite(value) || value < 0) return { ...empty, reason: 'scale_missing' };
  const ageDays = quoteAgeDays(t, now);
  return { value, missing: false, unit: unitFor(scale), scale, stale: ageDays == null || ageDays > 90,
    ageDays, source: t.source || null, sourceUrl: t.url || null, quotedAgo: t.quotedAgo || null,
    fetchedAt: t.fetchedAt || null, quoteUpdatedAt: t.quoteUpdatedAt || null,
    demand: t.demand || null, trend: t.trend || null };
}
function summarizeMarket(items, scale = 'value', now = Date.now()) {
  let total = 0, observed = 0, unpriced = 0, stale = 0, count = 0;
  for (const item of (items || []).filter(Boolean)) {
    const q = marketQuote(item, scale, now), quantity = quantityOf(item);
    count += quantity;
    if (q.missing) { unpriced += quantity; continue; }
    total += q.value * quantity; observed += quantity;
    if (q.stale) stale += quantity;
  }
  return { total, observed, unpriced, stale, count, complete: count > 0 && unpriced === 0 && stale === 0, scale: normalizeScale(scale), unit: unitFor(scale) };
}
function evaluateTrade(give, receive, fairBandPercent = 10) {
  if (!give.count && !receive.count) return { status: 'empty', verdict: null };
  if (!give.count || !receive.count) return { status: 'open', verdict: null };
  if (!give.complete || !receive.complete || give.scale !== receive.scale) return { status: 'incomplete', verdict: null };
  const difference = receive.total - give.total;
  // Symmetric denominator: swapping sides preserves fairness and flips win/loss.
  const denominator = Math.max(give.total, receive.total);
  const gapPercent = denominator === 0 ? 0 : Math.abs(difference) / denominator * 100;
  const verdict = gapPercent <= fairBandPercent + 1e-9 ? 'fair' : difference > 0 ? 'win' : 'lose';
  return { status: 'complete', verdict, difference, gapPercent, fairBandPercent };
}
const verdictLabel = result => result?.status === 'complete' ? ({ win: 'Win', fair: 'Fair', lose: 'Lose' }[result.verdict] || 'Not evaluated')
  : ({ empty: 'Add items to compare', open: 'Open to offers', incomplete: 'Trade value incomplete' }[result?.status] || 'Not evaluated');
const listingKind = items => {
  const list = (items || []).filter(Boolean);
  if (!list.length || list.some(i => !TRADE_COLLECTIONS.includes(i.collection))) return 'unknown';
  const fish = list.some(x => x.collection === 'fish'), cosmetic = list.some(x => x.collection !== 'fish');
  return fish && cosmetic ? 'mixed' : fish ? 'fish' : 'cosmetics';
};

const inventoryIdentity = item => {
  const c = item?.catch;
  return stableItemId(item) + '|' + (c ? JSON.stringify([c.weightKg, c.mutation || null, [...(c.attributes || [])].sort()]) : '');
};
function moveInventory(owned, gave, got) {
  const result = { owned: owned.map(i => ({...i})), removed: [], notOwned: [], added: [] };
  for (const item of gave) {
    let remaining = quantityOf(item);
    for (let i = result.owned.length - 1; i >= 0 && remaining > 0; i--) {
      const candidate = result.owned[i];
      if (inventoryIdentity(candidate) !== inventoryIdentity(item)) continue;
      const available = quantityOf(candidate), take = Math.min(available, remaining);
      remaining -= take;
      if (take === available) result.owned.splice(i, 1);
      else result.owned[i] = {...candidate, quantity: available - take};
    }
    if (remaining < quantityOf(item)) result.removed.push(item.name + ' ×' + (quantityOf(item) - remaining));
    if (remaining) result.notOwned.push(item.name + ' ×' + remaining);
  }
  for (const item of got) {
    result.owned.push({...item, imageUrl: item.image || '', addedVia:'trade'});
    result.added.push(item.name + ' ×' + quantityOf(item));
  }
  return result;
}
module.exports = { SCHEMA_VERSION, TRADE_COLLECTIONS, normalizeScale, unitFor, stableItemId, canTrade, resolveItem, parseStored,
  validateFeed, quoteAgeDays, marketQuote, summarizeMarket, evaluateTrade, verdictLabel, listingKind, quantityOf, inventoryIdentity, moveInventory };
