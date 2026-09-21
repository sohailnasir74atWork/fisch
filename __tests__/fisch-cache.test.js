const { fetchCatalogue, readCatalogueCache } = require('../Code/Helper/catalogueClient');
const { validateFeed } = require('../Code/Helper/feedContract');
const now = Date.parse('2026-09-19T12:00:00Z');
const data = Object.fromEntries(['fish','skins','boats','mutations'].map(collection => [collection, [{ name: 'Example', itemId: collection + ':1', collection }]]));
const feed = { meta: { schemaVersion: 2, game: 'fisch', generatedAt: new Date(now - 60000).toISOString(), buildId: 'abc' }, data };
const response = body => ({ ok: true, status: 200, text: async () => JSON.stringify(body), headers: { get: name => name === 'etag' ? 'etag1' : null } });
test('migrates object, single and double encoded caches, rejects wrong-game and empty feeds', () => {
  for(const raw of [feed, JSON.stringify(feed), JSON.stringify(JSON.stringify(feed))]) expect(readCatalogueCache(raw).data.fish).toHaveLength(1);
  expect(readCatalogueCache({ meta: { game: 'mm2' }, data })).toBeNull();
  expect(() => validateFeed({ meta: feed.meta, data: {} })).toThrow();
  expect(() => validateFeed({ meta: feed.meta, data: { ...data, fish: [{ ...data.fish[0], trade: { itemCategory: 'skins', value: 2 } }] } })).toThrow();
});
test('valid cache uses a 24h TTL, force refresh sends ETag and handles 304', async () => {
  const cached = { ...feed, checkedAt: new Date(now).toISOString(), etag: 'old-etag' };
  const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 304 });
  expect((await fetchCatalogue({ url: 'test', cached, fetchImpl, now })).fromCache).toBe(true);
  expect(fetchImpl).not.toHaveBeenCalled();
  const result = await fetchCatalogue({ url: 'test', cached, fetchImpl, now: now + 1000, force: true });
  expect(fetchImpl.mock.calls[0][1].headers).toEqual({ 'Cache-Control': 'no-cache', 'If-None-Match': 'old-etag' });
  expect(result.checkedAt).toBe(new Date(now + 1000).toISOString());
});
test('invalid, old and failed responses never replace the last good snapshot', async () => {
  const cached = { ...feed, checkedAt: '2026-09-01', etag: 'old' };
  const before = JSON.stringify(cached);
  for(const fetchImpl of [jest.fn().mockRejectedValue(new Error('offline')), jest.fn().mockResolvedValue(response({ error: 'bad' })),
    jest.fn().mockResolvedValue(response({ ...feed, meta: { ...feed.meta, generatedAt: '2026-09-01' } }))]) {
    await expect(fetchCatalogue({ url: 'test', cached, fetchImpl, force: true, now })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(cached)).toBe(before);
  }
});
test('new validated catalogue returns one atomic snapshot', async () => {
  const result = await fetchCatalogue({ url: 'test', fetchImpl: async () => response(feed), now });
  expect(result.meta.buildId).toBe('abc');
  expect(result.etag).toBe('etag1');
  expect(result.checkedAt).toBe(new Date(now).toISOString());
});

test('legacy migration bypasses the old HTTP cache and never reuses its ETag', async () => {
  const fetchImpl = jest.fn().mockResolvedValue(response(feed));
  const result = await fetchCatalogue({ url: 'https://example.test/data.json?region=pk',
    cached: { data, meta: {}, etag: 'legacy', checkedAt: new Date(now).toISOString() }, fetchImpl, now });
  expect(fetchImpl.mock.calls[0][0]).toBe('https://example.test/data.json?region=pk&schema=2');
  expect(fetchImpl.mock.calls[0][1].headers).toEqual({ 'Cache-Control': 'no-cache' });
  expect(result.meta.schemaVersion).toBe(2);
});

test('records decoded response bytes and does not invent transfer size', async () => {
  const result = await fetchCatalogue({ url: 'test', fetchImpl: async () => response(feed), now });
  expect(result.diagnostics.decodedBytes).toBe(Buffer.byteLength(JSON.stringify(feed), 'utf8'));
  expect(result.diagnostics.reportedBodyBytes).toBeNull();
  expect(result.diagnostics.source).toBe('network');
  expect(readCatalogueCache(result).diagnostics).toEqual(result.diagnostics);
});
