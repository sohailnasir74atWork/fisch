# Fisch data and trade corrections — 19 September 2026

This supersedes older claims in HANDOFF.md and DATA-PLAN.md about fish never having market quotes, Proto being ordinal, all rods being tradeable, and a verified nine-slot in-game limit.

## Product rules

- One mixed trade builder: fish plus eligible rod skins, boats, bobbers, lanterns, gliders, booths and halos. Actual fishing rods remain reference/guide items.
- Category eligibility is not sufficient: the feed carries per-item tradeability; mastery items and explicit untradeable notes are excluded.
- Nine rows per side is an app limit, not a verified statement about the game's trade window. Quantity is 1–99 identical items per row.
- Fish listings record actual kilograms, one mutation, supported attributes and quantity. Size is represented by weight, not another price multiplier.
- C$ means estimated NPC sale proceeds only. S$ and Proto are separate market scales; never convert or mix them.
- Fish market quotes use only the source's quoted species/variant. Weight and NPC mutation multipliers never create a market premium. Unquoted mutations/variants are unpriced.
- Both scales can be summed. Zero is a valid quote; null means missing.
- A W/F/L verdict needs both sides, all items priced on the same scale, and known quote ages no greater than 90 days. Unknown ages count as stale. A 10% symmetric band is Fair. These are app policies, not official game rules.
- Unpriced or stale trades can be posted, with a priced subtotal and “Trade value incomplete”; never silently saved as Fair. One-sided listings are “Open to offers.”
- Posts store versioned valuation snapshots, scale/unit, quantities, catches, source metadata, coverage and auto-classified Fish/Cosmetics/Mixed kind.
- Journal market evaluation and the user's subjective rating are separate fields. Legacy documents without a verified snapshot are not retrospectively declared Fair.

## Data flow

Game.Guide sitemap → public item pages → exact embedded prices + typed names → values candidate → category/name join with wiki catalogue → validated feed candidate + hashed images → Bunny publication → validated atomic MMKV snapshot → common app valuation functions.

The pipeline lives at ../_pipeline. It is separate from this Git repository.

- lib/values.js preserves decimals and prefers exact public page data over rounded display labels.
- lib/join-values.js requires category + normalized name. Ambiguities are reported, not guessed.
- extract.js creates dist/fisch/candidate without touching the live data.json. Cached images use wiki source hashes/revisions and conversion settings.
- Image filenames include content hashes. Old published images remain available to saved trades.
- publish.js checks schema, identity, coverage, file hashes and validation build ID. Uploads/verifies assets, verifies an immutable feed release, then changes/purges/verifies data.json last.
- refresh.sh stops on source/build/publish failure; no continuing with empty data.
- A full source scrape normally fails on any unavailable page. The explicit --quarantine-new-errors option only permits up to ten failed NEW URLs with no previous approved quote, and no drop in parsed row count. Source failures remain in metadata; no values are invented.

Five new Game.Guide URLs returned HTTP 500 after repeated attempts on 19 September. They are explicitly quarantined in the candidate metadata. The 1,279 previously known pages were all parsed; 840 have at least one price. 818 quotes joined unambiguously to the wiki catalogue.

## App cache and identity

Code/Helper/feedContract.js and fishRules.js are byte-identical to the pipeline's equivalents; pipeline tests enforce this.

catalogueClient.js validates the game/schema/collections/IDs/quote categories before returning a snapshot. It uses a 24-hour checked-at TTL, conditional ETags, a bounded timeout/retry, and rejects older responses. No MM2/Firebase feed fallback is allowed.

LocalGlobelStats commits data, metadata, ETag and checked-at as one MMKV record. Object, JSON-string and old double-encoded caches are migrated. Failed requests preserve the last good snapshot and expose a refresh warning.

Item identity is collection + wiki page ID, or a category/name key for page-table cosmetics. Version rows use version numbers; events and NPC subentries have distinct identities. Legacy inventory names resolve only when unambiguous. Inventory transfers preserve catch identity and quantities.

## Validation completed

- 14 app regression tests for valuation, catch variants, inventory transfer, cash rules and cache behavior.
- 6 pipeline regression tests for exact prices, category collisions, quarantine, identities, shrink guards and shared-code parity.
- Changed app sources parsed; no undefined references detected in the focused lint check.
- Android release APK build passed.
- Updated Home and Calculator launched in the emulator using Metro; custom Home icons visually checked.
- Candidate dry-run validated 5,181 rows and 4,889 local image hashes.
- Live publication is currently blocked by unavailable Bunny storage and API/purge credentials. Existing CDN feed has not been changed.

Commands:
  npm test -- --runInBand --watchman=false __tests__/fisch-market.test.js __tests__/fisch-sale.test.js __tests__/fisch-cache.test.js
  cd ../_pipeline && node --test test/contracts.test.js
  node publish.js fisch
  node --env-file=.env.bunny publish.js fisch --publish
  node verify.js fisch --all-images

Do not claim production deployment, live end-to-end fetching or an iOS device test until they have actually run. Existing unrelated service configuration warnings (for example AdMob consent forms) require their service consoles.

## Home icons and current dev session

Code/HomeTab/HomeIcons.jsx contains twelve original SVG icons (3,603 bytes of source, about 1,245 bytes gzip). It uses the existing react-native-svg dependency; no downloaded graphics or new icon font. Home uses an actual fishing rod, fish/ruler, market tag, timer, tackle box and consistent smaller shortcuts.

Metro is running on port 8081. The host rejected recursive/fallback watch handles, so this session uses a temporary /private/tmp/fisch-metro-watch.cjs preload to pass watch:false to Metro. Fast Refresh is unavailable in this session. Restart Metro after source changes to rebuild its file map; the emulator is connected via adb reverse tcp:8081 tcp:8081. This temporary development workaround is not part of the release APK.

## Calculator UI review (requested, not yet implemented)

Priorities: compact the oversized summary; use one result badge; grow empty item grids as items are added; display names, quotes and catch details inside item cards; separate edit from remove; default to All when inventory is empty; use horizontal category chips; make Create Trade primary with quieter Share/Log actions; use the Home icon style; show refresh warnings in a small Retry banner.

## Calculator UI update
The calculator now uses a compact comparison card, one result badge, compact K/M/B values, two growing item columns, explicit edit/remove actions, horizontal picker categories, and primary Create Trade with secondary Log/Share actions. Item editing replaces its original row. Catalogue requests use a schema-qualified URL and HTTP revalidation while retaining the 24-hour application cache. Focused suites: 15 passing tests.
