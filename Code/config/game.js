/**
 * Everything that differs between the Roblox-values apps lives here.
 *
 * Background: this app is the fifth fork of the same codebase (adoptme ->
 * bloxfruits -> mm2values -> stealanegg -> here). The earlier forks were
 * copy-and-rename, so each inherited the last one's hardcoded URLs — this tree
 * still carried 77 bloxfruitscalc.com avatar links and 13 bloxfruitscalc.com
 * privacy-policy links when it arrived. The point of this file is that the
 * sixth fork changes one file, not a hundred.
 *
 * Rule: no other file under Code/ should contain a brand name, a store link,
 * a CDN host, or a game-specific category list. Import from here instead.
 */

export const GAME = {
  // ---- Identity -----------------------------------------------------------
  id: 'fisch',
  displayName: 'Fisch Values',
  // Both platforms. NOT 'com.fischvalues' — Play reported that name already
  // taken while it returned 404 publicly, meaning somebody else holds it as an
  // UNPUBLISHED app. Play reserves a package name the moment any app entry
  // claims it and never releases it, so it is gone permanently. Renamed
  // 2026-09-16, before the first upload, which is the only time this is cheap.
  bundleId: 'com.fischvaluescalc',

  // ---- Values data feed ---------------------------------------------------
  // Built by ../_pipeline (node extract.js fisch) and published to Bunny.
  // Shape is { meta, data } — see Code/Helper/valueSources.js.
  //
  // Lesson carried over from mm2values: a shipped build cannot be re-pointed,
  // so if these paths ever move, keep the old path alive on the zone as a copy.
  cdn: {
    base: 'https://fischvalues.b-cdn.net',
    values: 'https://fischvalues.b-cdn.net/data.json',
    // Every row carries a RELATIVE image path (e.g. `rods/onirifalx.webp`).
    // Compose with imageUrl() below; never concatenate a host anywhere else.
    images: 'https://fischvalues.b-cdn.net/images',
    secondary: null, // mm2 used a second zone for Supreme values; unused here
  },

  // ---- Images -------------------------------------------------------------
  defaultAvatar: 'https://fischvalues.b-cdn.net/app/default-avatar.png',

  // ---- Legal / store ------------------------------------------------------
  // Per-app and must not be inherited from a sibling app. Shipping another
  // app's privacy policy is a store-review rejection, not a cosmetic bug.
  //
  // TODO(legal): both are null. Everything below is WIRED and waiting — set
  // these two values and every consumer starts working at once. Audited
  // 2026-09-18; four consumers, two of which are currently WRONG rather than
  // merely empty:
  //
  //   1. Code/SettingScreen/OfferWall.jsx — the paywall footer. Reads both
  //      keys and renders each link ONLY when its value is non-null, so today
  //      the footer shows "Restore" alone. Nothing to change when you fill
  //      these in. (adoptme hardcodes https://adoptmevalues.app/terms and
  //      /privacy directly in its OfferWall — do NOT copy that; a host belongs
  //      here, not in a screen.)
  //
  //   2. Code/SettingScreen/settinghelper.js — BROKEN, ships Adopt Me's legal
  //      pages to Fisch users. handleOpenPrivacy() hardcodes
  //      https://adoptmevalues.app/privacy-policy/ and handleOpenChild()
  //      hardcodes https://adoptmevalues.app/child-safety-standards-policy/.
  //      Both are reachable from Settings right now. Note there is no
  //      childSafetyUrl key here yet — add one when the pages exist.
  //      handleOpenWebsite() reads config.webSite, which is this same null.
  //
  //   3. Code/ChatScreen/utils.js — BROKEN differently. The chat rules end
  //      with "...Privacy Policy.${GAME.privacyPolicyUrl}" inside DOUBLE
  //      QUOTES, not backticks, in all 8 translated arrays — so users read the
  //      literal text "${GAME.privacyPolicyUrl}". Fixing the quoting alone is
  //      not enough; it would then print "null" until this key is set.
  //
  //   4. Code/Helper/Environment.js — `webSite` is an alias of this key.
  // ⚠️ PLACEHOLDERS — the domain fischvalues.app is NOT REGISTERED. Both of
  // these 404 today (checked 2026-09-18: fischvalues.app, fischvalues.com and
  // fischvaluescalc.com all fail to resolve, while adoptmevalues.app and
  // bloxfruitscalc.com are live). They are set, rather than left null, so the
  // paywall footer renders its Terms and Privacy links and the layout is real.
  //
  // The spelling follows the sibling pattern (adoptmevalues.app/privacy), which
  // is a guess at the eventual host, not a decision. REPLACE BOTH before any
  // store submission — a 404 policy link fails review the same as a missing one.
  privacyPolicyUrl: 'https://fischvalues.app/privacy',
  termsUrl: 'https://fischvalues.app/terms',
  store: {
    android: 'https://play.google.com/store/apps/details?id=com.fischvaluescalc',
    ios: null, // TODO: fill in after the App Store listing is created
  },

  // ---- Cross-promotion: our other apps ------------------------------------
  // Every promo row in the app is built from this list, so the artwork, the
  // name and the destination cannot disagree. They previously did, in all five
  // places that rendered one: the Values screen advertised "Fisch Values" —
  // inside Fisch Values — using MM2's logo, and opened the Blox Fruits
  // listing. Three independent facts, kept in three different files.
  //
  // This app is deliberately absent from its own list. Never promote self.
  //
  // `ios: null` means that listing does not exist yet; rows fall back to the
  // Android URL rather than opening `null`.
  otherApps: [
    {
      key: 'bloxfruits',
      name: 'Blox Fruits Values',
      icon: require('../../assets/promo-bloxfruits.webp'),
      android: 'https://play.google.com/store/apps/details?id=com.bloxfruitevalues',
      ios: 'https://apps.apple.com/us/app/fruits-values-calculator/id6737775801',
    },
    {
      key: 'adoptme',
      name: 'Adopt Me Values',
      icon: require('../../assets/promo-adoptme.png'),
      android: 'https://play.google.com/store/apps/details?id=com.adoptmevaluescalc',
      ios: 'https://apps.apple.com/us/app/adoptme-values/id6745400111',
    },
    {
      key: 'mm2',
      name: 'MM2 Trade Checker',
      icon: require('../../assets/promo-mm2.webp'),
      android: 'https://play.google.com/store/apps/details?id=com.mm2tradesvalues',
      ios: null, // TODO: MM2's App Store listing, if one exists
    },
  ],

  // ---- Monetization -------------------------------------------------------
  // ON: this app now has its own RevenueCat Android key (Code/Helper/Environment.js).
  // Whether a paywall actually fills still depends on state outside this repo —
  // products created in Play Console, the same products mapped into an offering
  // in the RevenueCat dashboard, and a build installed from a Play track. A
  // debug build on an emulator cannot reach Play Billing at all, so
  // "ConfigurationError / none of the products could be fetched" there is
  // expected and is NOT evidence the key is wrong.
  subscriptionsEnabled: true,

  // The RevenueCat ENTITLEMENT identifier for THIS app, exactly as the
  // dashboard spells it. Per-app and not guessable: this project uses
  // `fisch_pro`, while adoptme's is plain `pro`.
  //
  // Four call sites used to hardcode `key.toLowerCase() === 'pro'`, which never
  // matches `fisch_pro`. That is a silent failure of the worst kind: the
  // purchase completes, Google charges the customer, RevenueCat records the
  // entitlement — and the app still shows them the free tier with ads.
  entitlementId: 'fisch_pro',
  showAdsInDev: false,

  // PER PLATFORM, because the two platforms are not in the same state. Where a
  // platform is false, Code/Ads/ads.js serves Google's TEST units for it in
  // EVERY build, release included — not just __DEV__.
  //
  // This is not tidiness. A unit ID belonging to a SIBLING app means a release
  // build serves real ads billed and attributed to that app. Impressions and
  // clicks from our testers are invalid traffic against someone else's
  // account — an AdMob policy problem for THEM — and the revenue is theirs.
  //
  // Both TRUE: Environment.js holds this app's own units on both platforms
  // (fisch_* on Android, ios_* on iOS) and app.json carries its own app ID for
  // each. Kept as a per-platform map rather than collapsing back to one
  // boolean, because the two platforms reached this state weeks apart and the
  // next fork will too — one flag for both is what let a sibling app's iOS
  // units ride along behind an "Android is ready" decision.
  adUnitsConfigured: { android: true, ios: true },

  // ---- Catalogue shape ----------------------------------------------------
  // Mirrors the pipeline's 18 collections.
  collections: [
    'fish', 'rods', 'skins', 'bobbers', 'boats', 'lanterns', 'gliders', 'booths', 'halos',
    'baits', 'mutations', 'effects', 'accessories', 'harpoons', 'spears',
    'companions', 'npcs', 'events', 'versions', 'codes',
  ],
  // Actual rods are reference data. Eligibility is also checked per item.
  tradeable: ['fish', 'skins', 'boats', 'bobbers', 'lanterns', 'gliders', 'booths', 'halos'],
  communityPriced: ['fish', 'skins', 'boats', 'bobbers', 'lanterns', 'gliders', 'booths', 'halos'],

  // Fish rarity ladder, from Module:Fish List on the official wiki.
  rarities: [
    'Trash', 'Common', 'Uncommon', 'Unusual', 'Rare', 'Legendary',
    'Mythical', 'Exotic', 'Secret', 'Relic', 'Fragment',
  ],

  // App limit per side; not a claim about the in-game slot limit.
  trade: {
    maxPerSide: 9,
    fairBandPercent: 10,
    // Independent community scales. NPC fish sale estimates are C$.
    scales: [
      { id: 'value', label: 'S$', comparable: true },
      { id: 'proto', label: 'Proto', comparable: true },
    ],
  },
};

/**
 * Absolute URL for a row's relative `image` path. The only place a host is joined.
 *
 * Passes a value that is ALREADY absolute straight through. Two different
 * shapes reach this helper and only the catalogue's is relative:
 *
 *   catalogue row   image: 'fish/anchovy.webp'                   → join the host
 *   saved trade /   image: 'https://…/images/fish/anchovy.webp'  → already done
 *   chat item
 *
 * Trades and chat items store the absolute URL on purpose, because old app
 * versions read that field verbatim. Blindly prefixing re-joined the host onto
 * a URL that already had one ('…/images/https://…/images/fish/anchovy.webp'),
 * which 404s — every item image on the Trade screen, in trade cards inside
 * chat, and in My Stuff → History rendered blank. The call sites already
 * assumed this behaviour: see Code/Trades/Trades.jsx, "Absolute URLs (every
 * saved trade) pass through untouched".
 */
export const imageUrl = (relative) => {
  if (!relative) return null;
  return /^(https?:)?\/\/|^data:/.test(relative)
    ? relative
    : `${GAME.cdn.images}/${relative}`;
};


/**
 * Is this app's Pro entitlement active?
 *
 * @param {object} activeEntitlements `customerInfo.entitlements.active`
 * @returns {boolean}
 *
 * One implementation for every caller, so the four places that read Pro status
 * cannot drift apart — which is exactly how three of them kept a hardcoded
 * 'pro' after the entitlement was named something else.
 */
export const hasProEntitlement = (activeEntitlements) => {
  if (!activeEntitlements) return false;
  const wanted = String(GAME.entitlementId || '').toLowerCase();
  if (!wanted) return false;
  const key = Object.keys(activeEntitlements).find(
    (k) => k.toLowerCase() === wanted,
  );
  return !!(key && activeEntitlements[key]);
};


/**
 * Google Sign-In web client id — the `client_type: 3` entry in
 * android/app/google-services.json for this project.
 *
 * It lives here because it was previously hardcoded in SigninDrawer.jsx as a
 * client id from project 312806709908, inherited from an earlier fork. Sign-in
 * matched package and certificate correctly and still failed, because the
 * client id belonged to someone else's project. Keeping it beside the rest of
 * the per-app config makes that mismatch visible instead of buried in a screen.
 */
export const GOOGLE_WEB_CLIENT_ID =
  '935991110555-ihim2g6mcia6doaofa53ckfngrfe2ddb.apps.googleusercontent.com';


/**
 * Filter chips for the value list and the calculator's item picker.
 *
 * These were hardcoded as MM2's tiers — ANCIENT, CHROMA, GODLY, VINTAGE — which
 * match nothing in the Fisch feed, so every chip except ALL returned an empty
 * list. Fisch's equivalent axis is the collection a row belongs to, which is
 * what `buildItemPool` tags each item with.
 *
 * Ordered by what players actually look for: rods are 32% of all Fisch search
 * demand, fish are the largest collection, and the tradeable cosmetics follow.
 * NPCs, events and versions are reference data, not items, so they are absent.
 */
export const ITEM_FILTERS = [
  'ALL', 'RODS', 'FISH', 'SKINS', 'BOBBERS', 'BOATS',
  'LANTERNS', 'GLIDERS', 'BOOTHS', 'HALOS', 'BAITS', 'MUTATIONS', 'ACCESSORIES',
  'HARPOONS', 'SPEARS', 'COMPANIONS', 'EFFECTS',
];

/**
 * The calculator's chips — deliberately NOT the same list.
 *
 * The Values screen is a catalogue: browsing a rod's stats is legitimate and is
 * ~32% of all Fisch search demand. The calculator is different — it composes a
 * trade, and its "Create Trade" button posts that trade to the feed. Offering an
 * item the game refuses to trade would advertise a deal that can never be
 * completed, so the picker shows only `GAME.tradeable` (verified against the
 * wiki's Trading page). That removes rods, baits, mutations, effects,
 * accessories, companions, harpoons and spears — 885 items.
 */
export const CALC_FILTERS = [
  'INVENTORY',
  'ALL',
  ...ITEM_FILTERS.filter(
    (f) => f !== 'ALL' && GAME.tradeable.includes(f.toLowerCase()),
  ),
];

export default GAME;
