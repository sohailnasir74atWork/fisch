import { marketQuote, summarizeMarket, evaluateTrade, resolveItem, stableItemId, canTrade, moveInventory, quoteAgeDays } from '../Code/Helper/feedContract';
import { createTradeSnapshot, serializeTradeItem, savedTradeSnapshot, displayValueText, buildItemPool, pickerQuote, pickerValueText } from '../Code/Helper/valueSources';

const now = Date.parse('2026-09-19T12:00:00Z');
const cosmetic = (name, value, proto = value) => ({
  name, collection: 'skins', itemId: 'skins:' + name,
  trade: { itemCategory: 'skins', value, proto, quotedAgo: '1d', fetchedAt: new Date(now).toISOString(), source: 'game.guide' },
});
const summary = items => summarizeMarket(items, 'value', now);

test('one common valuation is symmetric, fair within 10%, and supports both scales', () => {
  const a = cosmetic('A', 100, 0.0001), b = cosmetic('B', 110, 0.0002);
  expect(evaluateTrade(summary([a]), summary([b])).verdict).toBe('fair');
  expect(evaluateTrade(summary([b]), summary([a])).verdict).toBe('fair');
  b.trade.value = 120;
  expect(evaluateTrade(summary([a]), summary([b])).verdict).toBe('win');
  expect(evaluateTrade(summary([b]), summary([a])).verdict).toBe('lose');
  expect(summarizeMarket([{ ...a, quantity: 3 }], 'proto', now).total).toBeCloseTo(0.0003, 10);
  expect(displayValueText(a, 'proto')).toContain('0.0001');
});

test('empty, one-sided, missing, stale and zero quotes are distinct', () => {
  const a = cosmetic('A', 100), unpriced = cosmetic('B', null), zero = cosmetic('Zero', 0);
  expect(evaluateTrade(summary([]), summary([])).status).toBe('empty');
  expect(evaluateTrade(summary([a]), summary([]))).toEqual({ status: 'open', verdict: null });
  expect(evaluateTrade(summary([a]), summary([a, unpriced]))).toEqual({ status: 'incomplete', verdict: null });
  const stale = { ...a, trade: { ...a.trade, quotedAgo: '6mo' } };
  expect(evaluateTrade(summary([stale]), summary([a])).verdict).toBeNull();
  expect(marketQuote(zero, 'value', now).value).toBe(0);
  expect(evaluateTrade(summary([zero]), summary([zero])).verdict).toBe('fair');
  expect(quoteAgeDays({ quoteUpdatedAt: 'bad' }, now)).toBeNull();
});

test('rods and restricted mastery cosmetics cannot enter market totals', () => {
  expect(canTrade({ ...cosmetic('Darkheart', 10), collection: 'rods' })).toBe(false);
  expect(canTrade({ ...cosmetic('Mastery', 10), obtain: 'mastery' })).toBe(false);
  expect(canTrade({ ...cosmetic('Mastery', 10), tradeability: { allowed: false } })).toBe(false);
  expect(marketQuote({ ...cosmetic('Darkheart', 10), trade: { itemCategory: 'rods', value: 10 } }).missing).toBe(true);
});

test('fish use quoted catch variants; NPC cash and mutation multipliers never enter market values', () => {
  const fish = { name: 'Nessie', collection: 'fish', avg_value: 50000,
    trade: { itemCategory: 'fish', proto: 60, value: null, variants: { shiny: { proto: 50 } }, quotedAgo: '1d', fetchedAt: new Date(now).toISOString() } };
  expect(marketQuote(fish, 'proto', now).missing).toBe(true);
  const caught = { ...fish, catch: { weightKg: 1000, mutation: null, attributes: ['Shiny'] } };
  expect(marketQuote(caught, 'proto', now).value).toBe(50);
  expect(marketQuote(caught, 'value', now).missing).toBe(true);
  expect(marketQuote({ ...caught, catch: { ...caught.catch, mutation: 'Midas' } }, 'proto', now).missing).toBe(true);
  const mixed = createTradeSnapshot([caught, cosmetic('A', 10)], [cosmetic('B', 60)], 'proto', now);
  expect(mixed.kind).toBe('mixed');
  expect(mixed.has.total).toBe(60);
  expect(mixed.evaluation.verdict).toBe('fair');
});

test('stable identity resolves legacy records only when unambiguous', () => {
  const pool = buildItemPool({ fish: [{ name: 'Darkheart', page_id: 1 }], skins: [{ name: 'Darkheart', page_id: 2 }, { name: 'Lucky+' }, { name: 'Lucky' }] });
  expect(resolveItem(pool, { name: 'Darkheart' })).toBeNull();
  expect(resolveItem(pool, { name: 'Darkheart', collection: 'skins' }).itemId).toBe('skins:2');
  expect(stableItemId(pool[2])).not.toBe(stableItemId(pool[3]));
  expect(resolveItem(pool, { itemId: 'fish:1', name: 'old', catch: { weightKg: 23 }, quantity: 2 }).catch.weightKg).toBe(23);
});

test('saved snapshots and item details survive JSON round trips without inventing legacy verdicts', () => {
  const a = cosmetic('A', 100), b = cosmetic('B', 120);
  const valuation = createTradeSnapshot([a], [b], 'value', now);
  const trade = JSON.parse(JSON.stringify({ valuation, hasItems: [serializeTradeItem(a, 'value')] }));
  expect(savedTradeSnapshot(trade).evaluation.verdict).toBe('win');
  expect(trade.hasItems[0].itemId).toBe('skins:A');
  expect(trade.hasItems[0].unit).toBe('S$');
  expect(savedTradeSnapshot({ status: 'f', hasTotal: 0 })).toBeNull();
  expect(savedTradeSnapshot({ valuation: { ...valuation, unit: 'Proto' } })).toBeNull();
});

test('inventory transfer respects category, quantity and exact catch', () => {
  const fish = { name: 'Nessie', collection: 'fish', itemId: 'fish:1', catch: { weightKg: 5, attributes: ['Shiny'] }, quantity: 3 };
  const otherCatch = { ...fish, catch: { weightKg: 10, attributes: ['Shiny'] } };
  const skin = cosmetic('Nessie', 10);
  const result = moveInventory([fish, otherCatch, skin], [{ ...fish, quantity: 2 }], [cosmetic('Received', 1)]);
  expect(result.owned[0].quantity).toBe(1);
  expect(result.owned[1].quantity).toBe(3);
  expect(result.owned[2].collection).toBe('skins');
  expect(result.notOwned).toHaveLength(0);
});

test('picker previews base fish quotes without treating missing prices as zero', () => {
  const fish = { name: 'Example fish', collection: 'fish', trade: {
    itemCategory: 'fish', proto: 3, value: null, quoteUpdatedAt: new Date().toISOString(),
  } };
  expect(pickerQuote(fish, 'proto')).toMatchObject({ missing: false, value: 3, base: true });
  expect(pickerValueText(fish, 'proto')).toBe('Base Proto 3');
  expect(pickerValueText(fish, 'value')).toBe('No quote');
  expect(marketQuote(fish, 'proto').missing).toBe(true);
  const unknown = { ...fish, trade: null };
  expect(pickerQuote(unknown, 'proto')).toMatchObject({ missing: true, value: null });
  expect(pickerValueText(unknown, 'proto')).toBe('No quote');
  expect(pickerQuote({ ...fish, catch: { weightKg: 1, mutation: 'Unknown' } }, 'proto').missing).toBe(true);
  expect(pickerQuote({ ...fish, trade: { ...fish.trade, proto: 0 } }, 'proto').missing).toBe(false);
});
