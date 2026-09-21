const { validateFeed, parseStored } = require('./feedContract');
function utf8Bytes(text) {
  let bytes = 0;
  for (const char of text) {
    const point = char.codePointAt(0);
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
function readCatalogueCache(raw) {
  const stored = parseStored(raw);
  if (!stored) return null;
  try {
    const { data, meta } = validateFeed(stored);
    return { data, meta, etag: typeof stored.etag === 'string' ? stored.etag : null,
      diagnostics: stored.diagnostics || null, checkedAt: stored.checkedAt || null };
  } catch { return null; }
}
async function fetchCatalogue({ url, cached, force = false, fetchImpl = fetch, now = Date.now(), timeoutMs = 15000 }) {
  const startedAt = Date.now();
  const cache = readCatalogueCache(cached);
  const checked = Date.parse(cache?.checkedAt);
  if (!force && cache?.meta.schemaVersion === 2 && Number.isFinite(checked) &&
      now >= checked && now - checked < CACHE_TTL_MS) return { ...cache, fromCache: true, diagnostics: { source: 'local-cache', durationMs: Date.now() - startedAt, decodedBytes: 0, reportedBodyBytes: 0 } };
  // Separate schema generations in native HTTP caches. Revalidate on network
  // refresh even when the CDN's max-age outlives our application cache TTL.
  const requestUrl = url + (url.includes('?') ? '&' : '?') + 'schema=2';
  const headers = { 'Cache-Control': 'no-cache' };
  if (cache?.meta.schemaVersion === 2 && cache.etag) headers['If-None-Match'] = cache.etag;
  let error;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(requestUrl, { method: 'GET', signal: controller.signal, headers });
      if (response.status === 304) {
        if (!cache || cache.meta.schemaVersion !== 2) throw new Error('304 without a supported cache');
        return { ...cache, checkedAt: new Date(now).toISOString(), fromCache: true, diagnostics: { source: 'not-modified', status: 304, durationMs: Date.now() - startedAt, decodedBytes: 0, reportedBodyBytes: 0, attempts: attempt + 1 } };
      }
      if (!response.ok) throw new Error('Catalogue HTTP ' + response.status);
      const body = await response.text();
      const { data, meta } = validateFeed(JSON.parse(body), { allowLegacy: false });
      const length = response.headers?.get('content-length');
      const reported = length == null ? NaN : Number(length);
      const diagnostics = { source: 'network', status: response.status,
        durationMs: Date.now() - startedAt, decodedBytes: utf8Bytes(body),
        reportedBodyBytes: Number.isFinite(reported) && reported >= 0 ? reported : null,
        contentEncoding: response.headers?.get('content-encoding') || null, attempts: attempt + 1 };
      // A rollback or out-of-order edge response must not silently replace a newer catalogue.
      if (cache?.meta.generatedAt && Date.parse(meta.generatedAt) < Date.parse(cache.meta.generatedAt)) throw new Error('Received an older catalogue');
      return { data, meta, diagnostics, etag: response.headers?.get('etag') || null, checkedAt: new Date(now).toISOString(), fromCache: false };
    } catch (e) { error = e; } finally { clearTimeout(timeout); }
  }
  throw error || new Error('Catalogue unavailable');
}
module.exports = { CACHE_TTL_MS, readCatalogueCache, fetchCatalogue };
