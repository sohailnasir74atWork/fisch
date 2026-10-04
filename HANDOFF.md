> **19 September 2026 data correction:** Read [FISCH-DATA-CONTRACT.md](FISCH-DATA-CONTRACT.md) first. It supersedes the historical pricing, eligibility, cache and publishing rules below. The corrected CDN candidate is validated but publication awaits local Bunny credentials.

# Fisch Values — handover

**Status: a signed release AAB exists, and it actually runs.** `versionCode 4`,
`versionName 1.0`, 67.9 MB, at
`android/app/build/outputs/bundle/release/app-release.aab`. Verified on the
artifact (not the build log) and launched from an installed release APK:

- versionCode 1 — never uploaded, shipped a broken x86 split (section 20)
- versionCode 2 — uploaded to internal testing, **crashed on every launch** (section 21)
- versionCode 3 — ProGuard rules added; onboarding -> sign-in -> Home verified on device
- versionCode 4 — same content as 3, rebuilt for upload after 2 was consumed

> **The versionCode 4 AAB is STALE.** It was built before the UI pass in
> section 22 — it has none of the safe-area fixes, the forced test ads, the
> splash fix or the calculator corrections. **Do not upload it.** Build a fresh
> one (versionCode 5) after reading section 22.

The real-device crash report the owner sent carried the identical stack trace
and the same R8-obfuscated wrapper (`sj8`) seen on the emulator, confirming the
emulator repro was the production bug and not a lookalike.

Fix verified three ways on the artifact, not the build log: R8's own `seeds.txt`
keeps `androidx.work.impl.WorkDatabase_Impl`, `usage.txt` does not list it as
removed, `mapping.txt` shows `WorkDatabase -> WorkDatabase` (name preserved),
and `WorkDatabase_Impl` is present in the shipped `base/dex/classes.dex`.


```
ABIs       arm64-v8a 27 · armeabi-v7a 27 · x86_64 27 · no x86
signer     SHA1 D1:95:A1:22:F9:1D:23:F1:B1:AD:22:21:FC:CB:F0:99:93:08:7A:F1
package    com.fischvaluescalc
```

**Still not submittable** — the privacy-policy URL is set
(`https://thesolanalabs.com/fisch/privacy`, 2026-09-23) but the page is not live
yet, the terms URL is a placeholder, and the AdMob / RevenueCat keys are still
Blox Fruit's. See Part 5.

Read Part 1, then Part 2. Part 2 is the domain knowledge that is wrong by
default: almost every mistake made in this project came from assuming how Fisch
trading works instead of checking.

**If you are about to ship**, read sections 20-23 first. They are the record of
the first release attempt, which produced three artifacts that all built
cleanly and were all wrong: one with a broken x86 split, one that crashed on
every launch, and one compiled against a stale package name.

> **The single most useful rule in this document:** `BUILD SUCCESSFUL` proves
> nothing. Every defect above passed the build. Verify the ARTIFACT
> (`unzip -l` the AAB, `jarsigner -verify` it) and then INSTALL AND LAUNCH it.
> Note `./gradlew … | tail` reports the pipeline's exit code, so a failed build
> reads as 0 — redirect to a log and check `$?`.

| | |
|---|---|
| App | `/Volumes/Sohail/AI_Projects/RunningApps/FischValues` (**no git**) |
| Pipeline | `../_pipeline` — shared across games |
| Research | `../_research/` — incl. `FISCH-VALUE-RATIONALISATION.md` |
| Run | `npm run android` · Metro on 8081 · emulator `Pixel9_API35_ARM` |
| Refresh data | `cd ../_pipeline && npm run refresh` |

---

# Part 1 — Orientation

## 1. What this is

Fifth fork of the shared values-app codebase (adoptme → bloxfruits → mm2values →
stealanegg → here), converted from Steal an Egg. **Steal an Egg is not being
built any more**; its Firebase project was repurposed rather than replaced, so
`project_id` stays `stealanegg-5ac52` forever. That is cosmetic — nothing reads it.

Why Fisch: it is the only candidate with a real two-sided trade window, so the
W/F/L calculator applies. See `../_research/FISCH-HANDOFF.md` for the full case,
including the ASO package (app name, descriptions, keywords) already written.

## 2. Identity

| | |
|---|---|
| Package / bundle id | **`com.fischvaluescalc`** (Android + iOS) |
| Display name | Fisch Values |
| Firebase | `stealanegg-5ac52` (project number 935991110555) |
| CDN | `https://fischvalues.b-cdn.net` |
| Emulator | `Pixel9_API35_ARM` |

`Code/config/game.js` is the single source for anything per-app: CDN, collections,
tradeable list, rarities, trade rules, and `GOOGLE_WEB_CLIENT_ID`. **Nothing else
under `Code/` should hold a brand name, host, store link or client id.**

## 3. What was done to the app

**Renamed** from StealAnEggValues (a copy — the original is untouched, there is no
git). Package, Java dir, iOS project/workspace/scheme, display names.

**Mini-games removed** (74,213 → ~59,500 lines): ArrowGame, SpotTheFake,
FindTheKiller, SafeCracker, QuickDraw, BombDefusal, MemoryMatch, SpinWheel,
DailyQuiz, GameHub, GameLeaderboard, XPBar, PetGuessingGame, the dispatcher, both
nav routes, the home grid, and a dead cloud function. **Egg hatching → cosmetics
was kept** (MysteryEgg, MyCosmeticsScreen, shopItems, xpUtils). Feed, Chat and
Trade kept per explicit instruction.

**`valueSources.js` rewritten** (647 → 295 lines) for the Fisch feed. The MM2
version expected two disagreeing catalogues and fields (`demand`, `range`,
`stability`) that no Fisch row has. Exported API is unchanged because 14 files
import it. The MM2/Supreme *source* toggle is now a **scale** toggle:

- `VALUE` — community S$ figure. Comparable, summable.
- `PROTO` — older ordinal scale, 3-4 orders of magnitude smaller.

`priceOf` **never falls back between scales**. Quoting a Proto figure as S$ is the
named Fisch scam; an item unpriced on the selected scale says so. Proto is never
summable. Fish are deliberately unpriced here — their worth is exact arithmetic
(`base_value / base_weight × weight × mutations`, verified on all 1,659).

**Design system** — `Code/Design/tokens.js` is now the only place a colour, size
or spacing value is decided:

| | before | now |
|---|---|---|
| `fontSize` literals | 824 across 27 sizes | **10** (deliberate heroes) |
| spacing literals | 2,052 | **538** (genuinely off-scale) |
| colour literals | 2,490 | ~1,450 (≈412 are content data, not chrome) |
| `Environment.js` hexes | 78 | **1** |

Scales are **fitted to the app's measured usage**, not a textbook ratio — 12pt is
used 121 times, 10pt and 6pt are the commonest spacings and neither sits on a 4pt
grid. Nothing moved more than 1pt.

Two font bugs fixed: `Lato-SemiBold` was used 10× but never bundled, and
`Lato-Ragular` was a typo — both silently fell back to the system font.

---

# Part 2 — Domain knowledge you must have

Everything here was verified against the official wiki or measured on the live
feed. Where an earlier assumption of mine turned out wrong, the correction is
kept in place deliberately — the wrong version is the intuitive one.

## 4. What is actually tradeable — verified, not inferred

Source of truth: the official wiki's Trading page
(`fischipedia.org/wiki/Trading`, fetched via `action=parse` — the HTML 403s):

> "the Trading Menu will open allowing both players to select any **fish,
> bobber, boat, or rod skin** that they own"
> Trade Plaza Sales Booth: "display items (e.g., **Skins, Bobbers, Gliders**, etc.)"

game.guide's trading hub independently lists "boats, rod skins, bobbers,
gliders". Lanterns are included because 18 carry real community quotes with
demand and trend data.

| | |
|---|---|
| **Tradeable (3,065)** | fish, skins, bobbers, boats, lanterns, gliders |
| **NOT tradeable (885)** | rods, baits, mutations, effects, accessories, companions, harpoons, spears |

**Rods themselves cannot be traded — only rod SKINS.** That one distinction
explains the whole "why does everything say no value" problem: the app was
offering 885 items that the game refuses to trade, so no value site prices them
and no price could ever exist.

`game.js` now separates two lists that were conflated:

- `tradeable` — what the GAME accepts (the six above).
- `communityPriced` — the five the community quotes. Fish are tradeable but
  never community-quoted; their worth is the game's own arithmetic.

**Applied:** the calculator's chips and its item pool are restricted to
`GAME.tradeable`. Composing a trade from a rod would have posted a listing to
the feed that nobody could ever complete. The Values screen still lists
everything — browsing a rod's stats is a different job, and ~32% of demand.

Verified on device: the picker now reads INVENTORY · ALL · FISH · SKINS ·
BOBBERS · BOATS · LANTERNS · GLIDERS, and ALL shows priced fish rather than
pages of "No value listed" rods.

## 5. Currencies and value scales — verified against primary sources

Three different numbers appear in this app and they are NOT interchangeable.
Everything below is from the official wiki or measured on the live feed, not
inferred.

### C$ — Cash
The primary in-game currency, earned by selling fish. Fish values in this app
are C$: the catalogue's `avg_value`, which our formula reproduces exactly.

### S$ — Shady Scrips
A **secondary** currency. The official wiki (`fischipedia.org/wiki/S$`):

> "Shady Scrips, denoted S$, is a secondary unit of currency in Fisch, used for
> acquiring Items, Fishing Rods, Baits, and other purchasable items in The Shady
> Bazaar and Trade Plaza."

It is the trading currency precisely because the Trade Plaza is one of only two
places it works, which is why community value lists quote in it.

**They convert — and that is the trap.** The Scrip Vendor exchanges at
**C$100,000 → S$1, one way**. Do NOT use that rate to fold fish into an S$
total: an average Megalodon is ~C$32,000, i.e. **S$0.32**, against traded skins
worth thousands of S$. The rate is a deliberate currency sink, not a market
rate, and converting through it would price every fish in the game at
effectively zero. Fish therefore display in C$ and are excluded from S$ totals
(`isSummable`), exactly as Proto is.

### Proto — a third-party value list, not a currency
game.guide shows three columns — TrueVal (their S$ list), Trade Hub (their own
marketplace median) and **Proto** — and **defines none of them on-page**. Proto
is a separate community-run value spreadsheet with tabs for Skins, Boats and
Miscellaneous.

The live feed corroborates that description exactly:

| | fish | skins | boats | bobbers | lanterns | gliders |
|---|---|---|---|---|---|---|
| **S$** | 0 | 212 | 182 | 24 | 18 | 17 |
| **Proto** | **0** | **355** | 193 | 7 | 1 | 11 |

Proto appears only on cosmetics and on **zero** of the 1,659 fish. Its numbers
run 0–7,200 with no fixed relationship to S$ — the value/proto ratio spans **50
to 283,333** — so these are different scales, not different units of one thing.

**Correcting an earlier assumption of mine:** Proto is not the "lesser, older"
list. For skins it covers **more** items than S$ does (355 vs 212). That is the
main argument for keeping the toggle rather than dropping it.

### What this means for the app
- Never sum across scales. One trade, one scale.
- `Trade Hub` is deliberately not scraped — it is game.guide's own liquidity,
  not community consensus. See `_pipeline/lib/values.js`.
- Coverage of tradeable items: **S$ 15%, Proto 18%**, fish 100% via C$.

## 6. Value coverage — the "everything says no value" problem

Measured, before: **667 of 3,950 listed items priced = 17%.** In a values app.
Two different problems were being displayed identically.

**1. Fish were never unpriced — we just weren't showing it.** All 1,659 fish
carry `avg_value` in the feed (the catalogue's own figure at average weight,
which our formula reproduces exactly). `priceOf` now returns it, so **1,655
items went from "No value listed" to a real number. Coverage 17% -> 59%.**

Critically, fish are quoted in the game's own currency and community values are
S$ — **different units**. So fish display as `C$ 33.3 avg` and are deliberately
**excluded from S$ trade totals** (`isSummable` returns false for them), exactly
as Proto is. Adding them to an S$ total would produce a number that looks like
money and is not. The Fish Value screen remains the way to value a specific
catch by its actual weight.

**2. The rest genuinely are not traded.** Rods, baits, mutations, effects,
accessories, companions, harpoons and spears — 885 items — have no community
quote because nobody trades them for currency; they are progression gear.
Listing them in a *price* list with "No value listed" is a presentation error,
not missing data. The Rods screen is the right model: show stats, not a price.
**Applying that to the other gear categories is the main piece of work left.**

**Codes were doubly dead and are now live.** The feed carried 76 codes,
`CodesDrawer` existed and was rendered — but `GlobelStats.js` never wrote
`localState.codes`, *and* `toggleDrawer` was never called from any control, so
there was no entry point either. Now: codes are stored with active ones sorted
first, a Codes pill on Home opens the drawer by route param, and expired codes
are dimmed and labelled — 75 of 76 are expired, so presenting them identically
would have handed users 75 codes that fail.

> **Reconciling the two figures in this section and the next.** 59% is measured
> against everything the app once listed (3,950 rows, including gear the game
> refuses to trade). 76% is measured against what is actually tradeable (3,065),
> which is what the calculator now shows. Both are correct; the denominator
> changed when section 4 removed 885 untradeable items. Quote **76%**.
>
> **And a THIRD figure appears in section 22: 69%.** That one is coverage on the
> DEFAULT S$ scale alone, which is what the calculator shows until the user
> touches the toggle. 76% counts an item as priced if it has a figure on EITHER
> scale. The 207-item difference is almost all skins, which carry more Proto
> quotes (350) than S$ (212). All three numbers are correct; they answer
> different questions:
>
> | figure | question |
> |---|---|
> | 17% | of everything the app once listed, incl. untradeable gear — obsolete |
> | 76% | of tradeable items, priced on either scale |
> | 69% | of tradeable items, priced on the scale the user is actually looking at |

## 7. Can we price the unpriced? Researched: no.

Full write-up: `../_research/FISCH-VALUE-RATIONALISATION.md`.

**Real coverage is 76%, not 17%** — the headline number counted collections the
game will not let you trade. Of 3,065 tradeable items, 2,321 carry a figure. The
genuine gap is **444 items: 333 bobbers (9% covered) and 111 lanterns (14%)**.

**Derived values were tested and rejected.** The wiki gives original Robux price
and stock cap; fitting the best least-squares model on the 73 skins that have
price, stock and a real value:

| | |
|---|---|
| correlation log R$ vs log S$ | 0.474 |
| **median error factor** | **3.0x** |
| within 2x of truth | 36% |
| worst miss | 29x |

Frostpiercer (R$1,499, 15,000 made) is S$15,000; Cyanic Demonride (R$2,499,
7,500 made) is S$7,400,000 — 493x apart on near-identical supply. Scarcity does
not determine desirability. **A value wrong by 3x carries the app's authority
into a trade the user then loses; "no value listed" is honest.**

**Shipped instead:** `supplyNote()` shows what an unpriced item originally cost
("R$199 · limited", "R$1,499 · 15,000 made"). It is context, never a value, and
it reaches **136 of 740 unpriced cosmetics** — a modest win, not a fix.

**Two of my own analyses were wrong and were corrected in the document:**

1. I classified `available: false` as "removed from the game" and proposed hiding
   those items. **Wrong** — it means *off sale*, and off-sale skins have the BEST
   coverage (72%) and include every one of the five most valuable items in the
   catalogue. Do not filter on `available`.
2. I claimed all 190 unpriced skins carry `robux`/`stock`/`window`. They carry
   those **keys**; ten have values. **This feed is full of present-but-null
   fields** — always test `v != null && v !== ''`, never `f in row`. The same
   mistake in app code is what made My Stuff unusable.

---

# Part 3 — The system

## 8. Data pipeline (`../_pipeline`)

```bash
npm run refresh          # catalogue + images + upload + verify + purge
npm run refresh:values   # weekly — also re-fetches community trade values
```

Live feed: **5,137 items, 18 collections, 4,844 images (122 MB), 667 priced.**

Sources: `fischipedia.org` (official wiki, Bucket API at `/w/api.php`) for the
catalogue; `game.guide` item pages for community values. Cadence is measured, not
guessed: only 4% of value quotes change within a week, so values are weekly and the
catalogue daily.

**Bunny traps, both already hit:**
- Storage files default to `cache-control: max-age=2592000` (30 days). `data.json`
  MUST be purged on upload or the app sees a month-old catalogue. `upload.sh` does
  this via the Keychain-stored API key.
- The edge **502s any URL containing "orgy"** — inside "porgy", a fish. Blocked
  slugs fall back to `id-<page_id>`.

Credentials live in macOS Keychain (`bunny-fischvalues`, `bunny-api-key`), never
in a file. See `../_pipeline/README.md`.

## 9. Firebase — all deployed

RTDB rules (hardened, by you) · Firestore rules · **14 composite indexes** ·
**25 Cloud Functions**. Functions were already byte-identical to MM2's; only
comments needed repointing.

`compute.googleapis.com` had to be enabled — Cloud Functions gen1 fails with a
misleading "default service account doesn't exist" without it.

**Retention functions are live and delete production data** (15-day window on
public chat, trades, feed). `cleanupOldPrivateChats` stays unexported, as in MM2.

## 10. Colour

`ACCENT` + `accentFor(name, isDark)` in `Code/Design/tokens.js`. Six hues
(lagoon, coral, amber, violet, kelp, rose), each with a light ink + tint and a
**separate dark ink + tint**.

The two-variant split is not decoration. Measured with WCAG contrast: the
light-mode inks sit at **2.19-3.07 on their own dark tints**, which is
unreadable — dark mode needs a *lighter* hue, not the same hue on a darker
ground. The `dark` variants measure **5.3-5.9** on both the dark tint and the
dark card. Light mode measures 3.6-5.5 on tint and 4.1-6.8 on white.

On Home, colour carries information rather than decorating: one hue per tool so
the grid is scannable by colour before it is read, amber for an upcoming event
(green when live), kelp for the portfolio card. Both themes verified on device.

Still visually plain, if you want to keep going: the header, the search bar, and
the large empty area the Status Feed occupies before anyone has posted.

## 11. Typography — the fonts were never linked

**The headings were not bold because Lato was never in the Android build.**

`assets/fonts/` had both faces and `react-native.config.js` declared them, but
the asset-link step had never been run for this fork. Verified by unzipping the
installed APK: **19 .ttf files, all vector-icon fonts, zero Lato.** Every
`fontFamily: 'Lato-Bold'` silently fell back to the system font.

That inverted the hierarchy, which is exactly what it looked like on screen:

- `TYPE.title` etc. set `fontFamily: FONT.bold` and **no** `fontWeight`, so with
  Lato missing they rendered **system REGULAR** — headings looked unbold.
- Meanwhile **391 style blocks set `fontWeight` with no `fontFamily`**, which
  renders in the SYSTEM font and *does* honour weight — so incidental labels
  were bold while actual headings were not.
- Net effect: Lato and Roboto drawn side by side, across **seven** CSS weights
  (300/500/600/700/800/900/bold), of which the app ships exactly **two** faces.

**Fixed:**

1. Copied `Lato-Regular.ttf` / `Lato-Bold.ttf` into
   `android/app/src/main/assets/fonts/` and rebuilt. New APK: **21 .ttf,
   Lato-Bold and Lato-Regular present.** Verified on device — screen headers now
   render bold Lato.
2. **All 395 `fontWeight` declarations removed** (Babel codemod, splice-based so
   files were not reformatted), replaced by `FONT.bold` / `FONT.regular`. Two
   dynamic ternaries converted by hand; 4 blocks that had *both* family and
   weight had the redundant weight dropped.
3. **235 hardcoded `'Lato-Bold'` / `'Lato-Regular'` literals tokenised** to
   `FONT.*`. The only ones left are inside commented-out JSX.
4. `Lato-SemiBold` and the `Lato-Ragular` typo — both referenced, neither ever
   shipped — now map to real faces.

**The weight ladder is binary, and that is deliberate.** No SemiBold exists in
any sibling project (checked), so 700+ is Bold and 400-600 is Regular. The first
pass mapped `>=600` to Bold and made the app **90% bold**, which destroys
hierarchy instead of creating it — `'600'` was the single most common weight
(151 uses) and was ordinary "medium" text. Corrected by recovering the original
weights from `../StealAnEggValues` (the fork source, which still has them) and
re-mapping at `>=700`. Now **279 bold / 123 regular**.

**Rule for new code: always set a family, never a weight.** `fontWeight` does
nothing useful here and reintroduces the system font.

The size ladder was reviewed and left alone: 32/24/20/16/14/12/11/10 with line
heights tightening from 1.43 at body to 1.19 at display is a correct
typographic progression. The one redundancy is three sizes inside a 2pt band
(12/11/10); collapsing 11 would touch 77 call sites for little gain.

**iOS is still unlinked** — `Info.plist` lists the fonts but
`project.pbxproj` has **0** Lato references, so they are not in Resources.

## 12. Brand assets — icon and splash

Artwork: the FVC hook mark. Master copy kept at `assets/brand/icon-master.png`
(1254x1254). The shipped icon set came from an EasyAppIcon export supplied by the
owner; regenerate from that tool rather than hand-resizing.

**Android launcher** — `mipmap-{l,m,h,xh,xxh,xxxh}dpi/` with `ic_launcher.png`,
`ic_launcher_round.png` and `ic_launcher_foreground.png`, plus
`mipmap-anydpi-v26/ic_launcher{,_round}.xml` and the colour
`values/ic_launcher_background.xml` (`#28a0fa`).

The adaptive icon is the conventional split — solid background colour, artwork
inset with transparent padding in the foreground layer. **That padding is what
makes the "FVC" wordmark survive**: Android masks adaptive icons to a circle or
squircle, and an earlier full-bleed attempt had the wordmark cropped off. Keep
the foreground padded.

**Splash** (react-native-bootsplash) — `drawable-*/bootsplash_logo.webp` at
288/432/576/864/1152, with `bootsplash_background` set to `#77B0DA` (sampled
from the artwork).

> The splash logo is inset to **70%** for the same reason, and it is
> load-bearing. Android 12+ renders the splash icon inside a circular container;
> a square only fits inside a circle at side <= diameter/sqrt(2). Without the
> inset the wordmark is clipped.

**iOS** — `ios/FischValues/Images.xcassets/AppIcon.appiconset/` previously held a
`Contents.json` listing sizes and **no image files at all**. Now 20 entries,
every filename present on disk, iPad sizes included.

> **All 15 iOS PNGs shipped with an alpha channel and were flattened to RGB.**
> App Store Connect rejects an app icon containing alpha. Every pixel measured
> fully opaque (alpha 255 throughout), so the conversion was lossless. If the
> icon set is ever regenerated, re-check this — most icon generators emit RGBA.
> The Android `ic_launcher_foreground.png` files must KEEP their alpha; the
> adaptive icon needs the transparent padding.

**In-app logos were Blox Fruits'.** `assets/icon.webp` and `assets/logo.webp`
were the "BFVC" pirate mark, inherited two forks back and still rendered in
`ValueScreen` and `Setting`. Both replaced from the master.

**A trap this left behind:** an early generation attempt used `set -- $pair` in a
loop, which zsh does not word-split, creating directories literally named
`mipmap-xxxhdpi 192`. They sat unnoticed until a later build failed with
`Invalid resource directory name`. If a resource build fails that way, look for
directory names containing a space.

---

# Part 4 — What the app does now

## 13. The three data-led screens — BUILT

All three shipped and verified on the emulator. Reachable from the Home
quick-action row (not as tabs — five tabs is already a phone tab bar's limit),
registered in `App.js`.

**`Code/Rods/RodsScreen.jsx` — rod comparison.** 262 rods, six stats at 100%
coverage (luck, lure, control, resilience, line distance, max weight), sortable
by any of them, best-in-game highlighted, and a two-rod head-to-head tray. It
shows **no price** on purpose: rods carry one community quote in the entire
catalogue, so a value column would be invented. Rod queries are ~32% of Fisch
search demand and no competing app has this screen.

**`Code/Timers/TimerScreen.jsx` — Black Market, Admin Abuse, weekly update.**
Driven entirely by `meta.schedule`, so a shifted schedule ships with the next
data build, not an app release. Each card carries the pipeline's own
`confidence` and `evidence` verbatim — "measured" and "community-reported" are
different claims and the screen never flattens them into one.

**`Code/FishValue/FishValueScreen.jsx` + `Code/Helper/fischValue.js`.** The exact
game formula, ported from `_pipeline/lib/fisch-value.js` and re-validated on
load: **1,659 of 1,659 fish, zero real misses.** Pick a fish, enter a weight
(min/avg/max shortcuts derived from `base_weight` and `weight_range`), toggle any
of 351 mutations read from the catalogue. Verified live: Megalodon at 58,500 kg
with Aether ×15 renders 409,290, matching an independent calculation exactly.

Four defects found and fixed while building these — each would have shipped
looking plausible:

1. **Black Market silently vanished from the timers.** Its schedule entry has a
   weekday and a 48h duration but **no `hourUTC`**, and the finite-check dropped
   the whole card — losing the single most-searched event in the game. It now
   defaults to 00:00 UTC and the UI says "exact hour unconfirmed" rather than
   inventing a precision the data lacks.
2. **Black Market also read "not live" while it was running.** On a Sunday
   `getUTCDay()` is 0, so the next-occurrence arithmetic landed on NEXT Saturday
   and stepped clean over an event in progress. The search now rewinds to the
   most recent occurrence before walking forward.
3. **`meta` never reached the app at all.** `loadFromCdn` in `GlobelStats.js`
   called `unwrapFeed` *before* storing, discarding the envelope — which is also
   why the Calculator's "Updated" label never showed a timestamp. Meta is now
   stored under its own `feedMeta` key rather than folded back into `data`,
   because `Trades/Notifier.js` reads the stored feed WITHOUT unwrapping and
   would have seen `[meta, data]` instead of the collections.
4. **Rod stats span ±1e21** (joke rods — Dave Rod, Tryhard Rod). A naive
   "divide by 1e6, add M" rendered 1e18 as `1000000000000.0M`, wrapping rows onto
   two lines. Also: a horizontal `ScrollView` in a flex column negotiates for
   leftover height, so when the compare tray mounted the sort chips kept their
   pill backgrounds but clipped their labels away — `flexGrow: 0` is load-bearing.

## 14. Home screen redesign

Rebuilt `Code/HomeTab/HomeTabScreen.jsx` around what the app is *for*. The old
screen put **nine** destinations in one horizontal scroller where only three and
a half fit on screen, at identical visual weight — so Rods (~32% of all Fisch
search demand) sat past the fold, and Daily Stars looked exactly as central as
the value tools. There was also no search anywhere on Home, which is the app's
single most common job.

New order, most-frequent job first:

1. **Header** — unchanged.
2. **Search** — a real input; submitting navigates to Values *with the query*, so
   you land on results instead of an empty list. New `q` route param.
3. **Live/next event strip** — "Black Market is live · 6h left", or a countdown.
   Renders nothing until the feed has a schedule. Taps through to Timers.
4. **Tool grid, 2x2** — Values · Rods · Fish Value · Timers, all visible, each with
   a subtitle a pill could never carry.
5. **My Stuff Worth** — below the tools deliberately: it reads 0 until you own
   things, so it must not be the first thing a new user meets.
6. **Secondary pills** — Friends, Daily Stars, Top Rated, Our Team, visibly smaller.
7. **Status Feed** · 8. **Cosmetics** (one quiet row) · 9. **Invite** · footer.

The clock moved to `Code/Helper/useNextEvent.js`, shared with TimerScreen so the
two can never disagree about when the Black Market opens. Home ticks it at 60s,
not 1s — the strip shows hours and days, so per-second re-renders of the whole
Home tree buy nothing.

**Four bugs fixed along the way:**

1. **`isSummable` was called with a price, not an item — at FOUR sites.**
   `priceOf(priceResult)` finds no `trade` field, returns `missing: true`, so
   `isSummable` returned **false for everything**. That is why "My Stuff Worth"
   and the My Stuff total were permanently 0, and why every item in the
   calculator's picker carried an "unpriced" badge. Fixed in `HomeTabScreen`,
   `MyStuffScreen` and `HomeScreen` (x2).
2. **The Values search box was uncontrolled** — no `value` prop at all. A query
   arriving from Home filtered the list while the box still showed its
   placeholder, with nothing to see or clear. It is now controlled by its own
   `inputText` state, kept separate from the debounced `searchText`: binding the
   input straight to a 300ms-debounced value makes typing visibly lag.
3. **A `defaultValue` cannot override an existing key.** `home.search_placeholder`
   already exists across the translation files as a generic "Search...", so the
   intended copy was silently discarded. New strings need genuinely new keys.
4. **React Navigation reuses a mounted screen**, so seeding search from
   `useState(route.params.q)` worked once and never again. The param is tracked
   in an effect now.

Note: the new UI strings (`home.search_values`, `home.rods`, `home.timers`,
`home.fish_value`, and the four `_sub` subtitles) exist only as English
`defaultValue`s. Non-English users see English until they are translated.

## 15. My Stuff — grouping, and a save bug that made it unusable

**Adding anything to My Stuff had never worked.** The object written to
Firestore was built with `id: item.id` and `category: item.type || item.category`
— and **no Fisch row has an `id`, a `type` or a `category`**. Firestore rejects
`undefined` with "Unsupported field value" and fails the whole document write,
so every add silently threw an unhandled promise rejection and nothing
persisted. That is why the inventory and its worth figure were always empty, and
it also meant the `isSummable` fix earlier could never be observed.

Now every field is defined or explicitly `null`, `collection` travels with the
row (tradeability depends on it), and `id` falls back to `itemKey(item)`.

**Grouping, as asked for:** one list, not two tabs — a split would put an item in
a different place based on a game rule the user did not choose. Instead:

- Tradeable items sort first, so what makes up the worth figure leads.
- Non-tradeable rows carry a **"Gear"** badge instead of a blank space, which
  says *why* there is no number rather than looking like a failed lookup.
- The header reads `ITEMS 1 / 1 GEAR, NOT TRADEABLE`, so a total of 0 next to a
  full inventory is explained rather than mysterious.

**A prerequisite that was nearly a silent data-loss bug:** removal was
`ownedPets.filter((_, i) => i !== index)` — an index into the RENDERED list.
Reordering the list for grouping would have made the X button delete a different
item than the one tapped. Removal now matches the row object itself, in both the
items and goals lists.

**Still open here:** fish are tradeable but valued in C$, so `isSummable`
excludes them from the S$ worth total (mixing the two would produce a
meaningless number). A fish-heavy inventory therefore also shows a 0 worth. The
honest fix is a second C$ line in the header rather than folding them together.

---

# Part 5 — Working on it

## 16. Traps that cost real time — read before debugging

1. **`DEVELOPER_ERROR` on Google Sign-In was NOT the fingerprint.** The code
   hardcoded a `webClientId` from project `312806709908` — a different Firebase
   project entirely. Sign-in matches package + certificate + client id and the
   error names none of them. Now `GOOGLE_WEB_CLIENT_ID` in `game.js`.
2. **Build failed 3× on CMake** — the Mac's internal disk was at 4.4 GB. CMake
   can't write its compiler probe and reports `CMAKE_CXX_COMPILER not set`, which
   reads like a broken NDK.
   > **`rm -rf ~/.gradle/caches` is NOT the fix** — the advice this entry
   > originally gave. The build re-downloads the cache immediately, so it frees
   > space and takes it straight back. `~/.gradle/caches` is now a symlink to
   > `/Volumes/Sohail/gradle-home/caches` and builds no longer touch the
   > internal disk at all. See section 21.
3. **`Plugin 'com.facebook.react.settings' not found`** — stale build dirs inside
   `node_modules/@react-native/gradle-plugin/*/build` survive a `~/.gradle` wipe.
   Delete them.
4. **The emulator needs explicit DNS** or every network call fails and the app
   renders blank: `emulator -avd Pixel9_API35_ARM -dns-server 8.8.8.8,8.8.4.4`.
5. **Metro on port 8081** — a stale Metro from the old app makes the CLI stall on
   an interactive prompt rather than failing.
6. **Migration scripts need the parser, not regex.** Babel scope analysis found 57
   unbound `c` references that a file-level grep called fine. Also watch: JSX
   attributes need braces (`color={X}` not `color=X`) — caught 3 separate times —
   and `fontSize: 12.5` becomes `SIZE.caption.5` if the regex only matches integers.

## 17. The "filter hangs the phone" bug

Reported as: My Stuff -> Add Items -> drawer -> press Filter -> phone freezes.
That drawer is `PetsModel` embedding `ValueScreen`, and its "Filter" button is
the **sort** toggle. Two compounding causes, both confirmed against the live
feed:

1. **The sort comparator parsed the DISPLAY string.** It called
   `getItemValue()` — which goes `displayValueText -> priceOf` with string
   formatting — *twice per comparison*: roughly **2·n·log2(n) ≈ 125,000 calls**
   for the pool, synchronously on the JS thread, every time the sort flipped.
   It was also **wrong**: `parseFloat("S$ 15K")` is `NaN`, so every priced item
   collapsed to 0 and the order was arbitrary (Darkheart at 15,000 sorted below
   Flying Dutchman at 1,000). Now decorate-sort-undecorate on the numeric
   `priceOf().value` — one call per item, and correct.
2. **FlatList was given duplicate keys.** `keyExtractor={item.id || item.name}`,
   but **no row in the Fisch feed has an `id`**, and **121 names are shared by
   255 rows** (four NPCs called Nico, three Bananas, "Lucky" / "Lucky+").
   Duplicate keys break React's reconciliation and make a long list thrash on
   every re-render. Now `itemKey()` in `valueSources.js` — the same
   `collection:page_id` identity `buildItemPool` already uses to dedupe, so keys
   and dedupe can never disagree. Measured: **134 collisions -> 0.**

Also fixed while there: `handleSearchChange` was `debounce(...)` rebuilt on every
render, so each keystroke got a fresh timer and nothing was actually debounced —
every character ran its own filter pass over the pool. Now memoised.

Verified on device after the fix: four rapid sort toggles and three category
filter changes produced **zero `Choreographer` skipped frames and zero ANRs**.

**Use `itemKey` for every new list.** `item.name` is not unique in this game.

## 18. Other fixes worth knowing about

Three changes, all confirmed on the running emulator — re-check them before
assuming a regression elsewhere:

1. **The trade grid is 9 slots per side in a 3x3 block** (`GRID_STEPS = [9, 12,
   15, 18]`, `flexBasis: '30%'`), matching Adopt Me and Fisch's real trade window.
   MM2's 4 was *that* game's limit and was copied here by accident — the comment
   above it already said `0 -> 9, 1 -> 12` while the values said otherwise.
2. **An empty side no longer reports "9 items Unpriced".** The grid is a
   fixed-length array of `null` slots and `summarizeItems` was pricing the holes.
   It now filters them, and `count` means items, not slots.
3. **The calculator no longer opens on a green WIN.** `getTradeStatus` took two
   totals and treated 0 vs 0 as a win "because that's the initial state". In Fisch
   a 0 total *also* means every item on that side is unpriced — fish are valued by
   arithmetic and Proto is ordinal — so a real nine-item trade could read WIN
   without a single price behind it. It now takes the summaries, returns `null`
   when nothing is priced, and all three pills sit inactive.

4. **Every filter tab now returns items** (RODS 262, FISH 1,659, SKINS 569 …).
   The calculator's matcher still tested `item.Category` / `item.type` — MM2
   fields no Fisch row carries — so every tab except ALL came back empty while
   looking perfectly functional. Both screens now share `matchesFilter` in
   `valueSources.js`, next to the `buildItemPool` call that does the tagging,
   because those two are what must agree.
5. **`npcs`, `versions` and `events` no longer reach the UI.** 1,111 rows of
   reference data — shopkeepers, changelog entries, calendar rows — sat under ALL
   in a trade calculator, where "Update v1.4.2" was offerable. The pool is now
   derived from `ITEM_FILTERS`, so adding a tab is the only step needed to
   surface a collection and the two cannot drift.
6. **"Not tradeable" was a lie and is now "No value listed".** It fired for any
   collection outside `GAME.tradeable`, telling a rod owner the game forbids
   trading rods. It does not — the value *sites* only cover cosmetics. Measured:
   all 666 community prices sit in boats (221), skins (379), bobbers (31),
   lanterns (18), gliders (17); rods have exactly one, Darkheart. An item with a
   real quote in an uncovered collection is still priced.
7. **`source.uri should not be an empty string`** (×4 in the console) — six rows
   carry no art and `resolveItemImage` returned `''`. It returns `undefined` now,
   which RN accepts silently; the three `|| GAME.defaultAvatar` sites still work.
8. **Two colour defects.** The active filter chip was hardcoded MM2 pink
   (`#FF9999`); and `ValueScreen` had a **duplicate `selectedOption` key** left
   among commented-out MM2 leftovers, which being later in the same object
   silently overrode the real one and painted the selected filter green.

These were all found and fixed in the same pass as the screens in section 13;
they are recorded because each was silent — the app looked correct while being
wrong. See section 20 for what is still open.

## 19. Cross-promotion — every row pointed somewhere else

Fixed 2026-09-16. The app promotes our other titles in two places, and **not
one of the five rows was internally consistent**:

| Where | Image | Label said | Tapping opened |
|---|---|---|---|
| Values screen, ad 1 | Fisch FVC | "Blox Fruits Values" | Adopt Me |
| Values screen, ad 2 | MM2 | "Fisch Values" | Blox Fruits |
| Settings, row 1 | Fisch FVC | "Blox Fruits Values" | Adopt Me |
| Settings, row 2 | MM2 | "Fisch Values" | Blox Fruits |
| Onboarding | MM2 | *(app's own identity)* | — |

Two rows advertised **Fisch Values from inside Fisch Values**, and a new user's
very first screen carried MM2's red wordmark. The helper names were inverted
too: `handleBloxFruit()` read `config.otherapplink`, which was the Adopt Me
listing.

**Why it drifted:** the artwork, the name and the store link were three
independent facts kept in three different files (`assets/`, inline JSX, and
`Environment.js`), so a fork could update one and leave the other two. They are
now one record — `GAME.otherApps` in `Code/config/game.js` — and every row is
rendered by mapping over it, so they cannot disagree again.

- `openOtherApp(app)` in `settinghelper.js` replaces `handleBloxFruit` /
  `handleadoptme`. It takes the app record instead of naming a destination.
- `otherapplink` / `otherapplink2` are gone from `Environment.js` — sibling
  brand URLs there are exactly what the `game.js` rule exists to prevent.
- Promo art is now named for what it is: `promo-bloxfruits.webp` (BFVC pirate
  mark, recovered from `../Blox_Fruit/assets/icon.webp` — this fork had
  overwritten its copy with Fisch's), `promo-adoptme.png`, `promo-mm2.webp`.
- Onboarding uses `assets/logo.webp`. The `config.isNoman` ternary it replaced
  had **the same file in both branches** (one via an `assets//` double slash),
  so the flag meant to switch the logo did nothing.
- **MM2 is a real row now**, labelled "MM2 Trade Checker" against
  `com.mm2tradesvalues`. It previously existed only as a commented-out block
  that called an undefined `handleMM2` under the label "Fisch Values".

**Dead assets removed:** `assets/splashscreen.png` and `assets/splashscreen.webp`
— Adopt Me Values artwork, inherited two forks back, referenced nowhere.
`splashscreen.png` was byte-identical to `adoptme.png`; that one was KEPT and is
now `promo-adoptme.png`. Neither had anything to do with the real splash screen,
which is `drawable-*/bootsplash_logo.webp` (section 12).

> **The Values-screen ads are not actually shown.** Their render site is
> commented out at `ValueScreen.jsx`. They were fixed rather than deleted
> because Settings promotes the same three apps, and the two surfaces drifting
> apart is the whole reason this section exists. `showAd1` / `toggleAd` existed
> only to flip between the two old components and were removed from
> `ValueScreen`; the keys still sit unused in `LocalGlobelStats.js`.

Verified: parses under the RN babel preset, and `react-native bundle` resolves
all three promo images into `drawable-mdpi/assets_promo*`.

## 20. Two traps a package rename sets — both silent

Hit on 2026-09-16 renaming to `com.fischvaluescalc`. Neither announces itself.

### Stale autolinking codegen survives the rename

The build failed with:

```
ReactNativeApplicationEntryPoint.java:34: error: package com.fischvalues does not exist
    if (com.fischvalues.BuildConfig.IS_EDGE_TO_EDGE_ENABLED) {
```

...against a file **nothing in the tree references**, long after every source
file said `com.fischvaluescalc`. `android/build/generated/autolinking/autolinking.json`
caches the package name, and Gradle considered the task up-to-date because its
*declared* inputs had not changed — the package name is not one of them.

**After any package rename, delete `android/build/generated/autolinking` and
`android/app/build/generated/autolinking`.** A full `clean` also works and costs
the entire native build. Stale release resource intermediates
(`aapt_proguard_file`, `linked_resources_binary_format`,
`stable_resource_ids_file`, `merged_manifest`) are worth clearing in the same
pass for the same reason.

### The bundle shipped a broken 32-bit x86 split

Caught only by inspecting the finished AAB. `unzip -l` gave:

| ABI | native libs |
|---|---|
| arm64-v8a | 27 |
| armeabi-v7a | 27 |
| x86_64 | 27 |
| **x86** | **6** |

The six were React Native's own AAR prebuilts — `libreactnative`, `libhermesvm`,
`libjsi`, `libfbjni`, `libc++_shared`, `libhermestooling`. Missing were all 21
project-built ones, including `libappmodules.so`, `libreanimated.so`,
`libmmkv.so` and the four crashlytics libs.

`defaultConfig.ndk.abiFilters` correctly kept x86 out of the CMake build, and
`packaging.jniLibs.excludes += ["**/x86/**"]` was meant to strip the AAR
prebuilts — **it does not match them.** So the two mechanisms between them
produced a split with a sixth of its libraries, and Play serves one ABI split
per device: any device resolving to x86 gets a guaranteed launch crash on
`libappmodules.so`. That is the identical failure the `abiFilters` comment was
written to prevent for x86_64.

**Fixed** by removing `x86` from `reactNativeArchitectures` in
`android/gradle.properties`, so it is never produced in the first place rather
than filtered afterwards. Exposure was small — 32-bit x86 Android is effectively
extinct, and Chromebooks / WSA / Play Games on PC are all x86_64, which was
complete — but the artifact was wrong.

> **Verify the artifact, not the build log.** `BUILD SUCCESSFUL` said nothing
> about either of these. The ABI table above comes from
> `unzip -l app-release.aab | grep base/lib/`, and the signer from
> `jarsigner -verify -certs`. Run both on every release bundle.
>
> Note also that `grep -o "base/lib/[a-z0-9_-]*"` silently reports `x86` for
> `x86_64` rows; split on `/` and count instead, or the table lies to you.

## 21. The first release build crashed on every launch

Uploaded to internal testing 2026-09-16, crashed immediately after the splash
on every device. Reproduced on the emulator and fixed the same day.

```
java.lang.RuntimeException: Unable to get provider
  androidx.startup.InitializationProvider:
  Failed to create an instance of class androidx.work.impl.WorkDatabase.canonicalName
```

**Cause: `proguard-rules.pro` was EMPTY while `build.gradle` used the aggressive
`proguard-android-optimize.txt`.** Room builds its database by calling
`getCanonicalName()` and reflectively loading `<name>_Impl`. R8 renamed
`WorkDatabase` and dropped the `InnerClasses` / `EnclosingMethod` attributes
that canonical-name resolution depends on, so `WorkDatabase_Impl` could not be
found. WorkManager initialises from an `androidx.startup` ContentProvider, so it
fails inside `handleBindApplication` — **before a line of JS runs**, which is
why it presents as "crashes after the splash" with a stack trace naming nothing
we wrote.

`androidx.work` arrives via `@notifee/react-native` (`work-runtime:2.8.0`).

**Why only this fork.** All four apps have that dependency and each survives for
a different reason:

| app | default rules | own rules | ships? |
|---|---|---|---|
| mm2values | `proguard-android.txt` (no optimize) | 0 lines | yes |
| Blox_Fruit | `proguard-android-optimize.txt` | 95 lines | yes |
| adoptme-jan7 | `proguard-android-optimize.txt` | 53 lines | yes |
| StealAnEggValues | `proguard-android-optimize.txt` | **0 lines** | never built |
| FischValues (was) | `proguard-android-optimize.txt` | **0 lines** | crashed |

This fork inherited Steal an Egg's config. Steal an Egg was never built for
release, so the defect was invisible until the first Fisch release build. Note
neither shipping sibling keeps Room or WorkManager explicitly — they survive on
the `-keepattributes InnerClasses/EnclosingMethod/Signature` block alone.

**Fixed:** `proguard-rules.pro` now carries the attributes block, explicit
Room/WorkManager/startup keeps, and the rest of the stack (RN core, reanimated,
Nitro, Firebase, GMS, RevenueCat, notifee, UI libs, okhttp).

**Verified on the emulator, not in the build log** — installed the release APK,
launched, and walked onboarding -> sign-in -> Home. `Running "FischValues"`,
`Loaded ... data from CDN`, Home rendered with "Black Market in 2d 10h" and
"Compare 262 rods". No FATAL.

> **A release build is not tested until it has been installed and launched.**
> The build that crashed on every device said `BUILD SUCCESSFUL`. Run
> `assembleRelease`, install the APK, open it and read logcat before uploading
> — `bundleRelease` succeeding proves only that R8 did not throw.

## 22. The UI pass after the first internal-testing build

Five issues reported from a real device, all fixed and verified on the emulator
(3-button navigation, which has a LARGER bottom inset than the gesture bar and
is the harsher test).

### Content hid behind the navigation bar, app-wide

Not a few screens — **zero files in the app applied `insets.bottom`.** All 17
that called `useSafeAreaInsets` used it for top only. Three causes compounded:

1. **`targetSdkVersion 36` forces edge-to-edge on Android 15+.** The
   `edgeToEdgeEnabled=false` in `gradle.properties` does NOT opt out at that API
   level, so every screen draws under the navigation bar.
2. **App.js's root `SafeAreaView` was imported from `react-native`.** That
   component pads on iOS ONLY; on Android it is a plain View. It looked like the
   app handled safe area and it never had.
3. **Onboarding renders outside `NavigationContainer`**, so it had no provider
   at all — `useSafeAreaInsets()` there would have thrown. That is why it used a
   hardcoded `paddingBottom: 50`, a number that is near a gesture bar and wrong
   for 3-button nav.

Note React Navigation mounts its own `SafeAreaProviderCompat` inside
`NativeStackView`, which is why the hook worked in navigator screens and the app
did not crash. The app's own provider was still missing.

**Fixed at the root, not by patching 40 screens:** `SafeAreaProvider` with
`initialWindowMetrics` in `index.js` (above onboarding); the no-op `SafeAreaView`
replaced; onboarding on real insets; and every stack screen padded through the
navigator's `contentStyle`. **`MainTabs` is exempt** — its tab bar already does
`height: 56 + insets.bottom`, so padding it again doubles the gap.

Then every bottom sheet, 14 of them, individually: SigninDrawer, both calculator
drawers, PetsModel, ValuesScreen/Code, Setting (x3), DailyStarRewards,
OnlineUsersList, CommentsModal, TradeCompletion, LeaderboardModal, BottomDrawer,
MessageInput, PrivateMessageInput.

> **An inline `paddingBottom` REPLACES the bottom side of a `padding`
> shorthand.** `Setting.jsx`'s drawer has `padding: SPACE.xxl` and
> `PrivateMessageInput` has `paddingBottom: SPACE.xxxl`; setting
> `paddingBottom: insets.bottom` there would REDUCE their spacing on a device
> with a small inset. Those two add instead: `SPACE.xxl + insets.bottom`.

### Calculator filter labels wrapped

The vertical side selector (INVENTORY, ALL, FISH, …) wrapped to two lines.
`SIZE.label` is **10pt, already the smallest step on the type scale**, so the
fix is room, not a smaller font: the gutter and chip padding were trimmed, and
the label is now `numberOfLines={1}` with `adjustsFontSizeToFit`, so a device
with large system font scaling shrinks instead of wrapping.

### A selected fish showed no value

Not a lookup failure. `priceOf` returns the fish's `avg_value` — in **C$** —
while the calculator totals in **S$**, and `isSummable` excludes fish so the
total ignored them. The exclusion is correct (section 5: the Scrip Vendor's
one-way C$100,000 -> S$1 sink would price an average Megalodon at S$0.32), but
dropping them silently is what read as a broken calculator.

`summarizeItems` now also returns `cashTotal` / `cashCount` / `cashTotalText`,
and the header carries a **Fish (C$)** row beside the S$ verdict. A second bug
fell out: `excludedCount` counted `modeled + unpriced`, so a perfectly
well-priced fish was reported as **Unpriced**. It now subtracts `cashCount`.

### Live ads were served from a sibling app's AdMob units

`Code/Ads/ads.js` had `developmentMode = __DEV__`, so release builds used the
real unit IDs — which belong to another app in this repo. Internal testers were
generating impressions billed and attributed to **that** app: invalid traffic
against someone else's AdMob account, with the revenue theirs, not ours.

Now gated on `GAME.adUnitsConfigured` (false), which forces Google's TEST units
in **every** build including release. All five ad types resolve through
`getAdUnitId`, so nothing bypasses it. Flip that one flag when `Environment.js`
holds our own IDs.

### The splash screen showed twice

**`MainActivity.kt` never called `RNBootSplash.init()`.** That call hands the
Android 12+ SplashScreen to the library and holds it until JS calls `hide()`.
Without it the system splash dismisses as soon as the activity draws and the
theme's logo shows again behind React — one splash, seen twice. All three
sibling apps have the call; this fork was converted without it. The try/catch
around it is carried from adoptme-jan7, which guards a real NullPointerException
on 16 KB page-size devices.

### "Many items have no value" — measured, and partly a bug

Reported from the device. Measured against the live feed, the calculator's
default S$ scale prices **2,108 of 3,065 = 69%**. Three different situations
were hiding behind that one number:

| collection | rows | S$ priced | Proto priced |
|---|---|---|---|
| fish | 1,659 | **1,655 (100%)** | n/a — C$ |
| boats | 315 | 182 (58%) | 189 (60%) |
| gliders | 29 | 17 (59%) | 11 (38%) |
| skins | 569 | 212 (37%) | **350 (62%)** |
| lanterns | 129 | 18 (14%) | 1 |
| bobbers | 364 | **24 (7%)** | 7 |

1. **Fish: no gap at all**, 100% priced.
2. **Bobbers and lanterns are the genuine hole** — ~450 items nobody quotes.
   Not fixable here; section 7 tested deriving values and rejected it at a
   median 3x error.
3. **207 items were priced and displayed as unpriced.** Mostly skins, which
   carry more Proto quotes (350) than S$ (212). On the default S$ scale they
   read as valueless.

**Two fixes.** The label for `SCALE_MISSING` said "Not priced on this scale" —
true but a dead end. It now names the scale that *does* have a figure:
**"Proto only"** / **"S$ only"**, so the answer is to flip the toggle. It
deliberately does NOT print the other scale's NUMBER — quoting a Proto figure
where S$ is expected is the named scam, and the two run 50x to 283,333x apart.
(`NO_QUOTE` was also shortened to "No quote"; the grid cell is a third of the
list width and both labels were truncating to "Priced on Proto o…".)

**And the toggle did not actually work in the calculator's picker.**
`renderGridItem` and `renderFavoriteItem` in `HomeScreen.jsx` both render
`displayValueText(item, valueSource)` but **omitted `valueSource` from their
useCallback deps**, so they kept a stale closure over whichever scale was active
when they were created. Flipping S$/Proto changed every total on the screen
while the picker kept showing the old scale — which reads as a dead toggle.
Fixed, plus `extraData={valueSource}` on the FlatList.

> `ValueScreen`'s own `renderItem` already had `valueSource` in its deps, with a
> comment warning about exactly this. The calculator's picker is a SEPARATE
> implementation in `HomeScreen.jsx` and never got the same treatment. When
> fixing a hook-dependency bug in one list, check the other one.

### The Proto scale reported every priced item as "Unpriced", and totalled 0

Reported from the device: a fish on one side, a rod skin with a Proto value of 5
on the other, and the header read **"1 item Unpriced"** with every figure at
**0**.

Both were wrong, and for the same underlying reason: **on the Proto scale
`isSummable` returns false for EVERYTHING** — Proto is an ordinal rank, so
summing it is meaningless by design (section 5). That routed every Proto-priced
item into `modeled`, and the header lumped `modeled + unpriced` under the label
"Unpriced". A perfectly well-quoted skin was told it had no value.

Meanwhile the totals rendered `0`, which claims a number that cannot exist: a
Proto total is not zero, it is *undefined*.

**Fixed three ways:**
- `summarizeItems` exposes `notSummable` (priced, but cannot be added — fish
  excluded, they have their own C$ line).
- `excludedCount` is now `unpriced` ALONE. A new **"Ranked, not summed"** row
  carries the rest, so "priced but not addable" and "no figure at all" are never
  conflated again.
- On the Proto scale both side totals and the difference render **—**, not `0`.

Verified on device: fish + Proto-ranked skin now reads
`— / Ranked, not summed 1 item / Fish (C$) C$ 33.3 / —`, and the same trade on
S$ reads `0 vs 15,000` with WIN active and the fish's C$ on its own line.

> **A "0" and a "not applicable" are different claims.** This header made the
> same mistake twice — once for fish in an S$ total, once for everything on
> Proto. If a value cannot exist on the selected scale, say so; do not render a
> zero that looks like a measurement.

### Found but NOT fixed — needs a decision

- **15 of 78 style keys in `ValueScreen` are duplicated** (`filterText`, `icon`,
  `itemBadge`, `badgeButton`, …). The later definition silently wins, so editing
  the first does nothing. Same defect as the `selectedOption` duplicate in
  section 18.
- **9 user-facing "pets" strings** remain in the translation files
  (`selected_pets`, `owned_pets`, `limit_pets`, `pets_count_plural`, "up to 18
  pets in a message", the onboarding subtitle "Track pets values & optimize your
  trades"). Adopt Me copy in a fishing game, across five languages.

## 23. The paywall replaced, and a banner size change

Worked 2026-09-18, on an emulator (Pixel9_API35_ARM, API 35) with a freshly
built debug APK. Note the release-signed APK from section 21 was still installed,
so `installDebug` failed with `INSTALL_FAILED_UPDATE_INCOMPATIBLE` until it was
uninstalled — that is expected, not a regression.

### The hosted paywall was RevenueCat's stock template

`Purchases.getOfferings()` was failing outright with `ConfigurationError` — "no
Play Store products registered in the RevenueCat dashboard for your offerings".
That is a dashboard problem, not a code one; the key in `Environment.js` is
valid (a wrong key fails with an *auth* error, not this). Once the owner mapped
products into the offering, the wall opened with live prices.

What it opened was the problem: `RevenueCatUI.presentPaywall()` rendered a pink
template **titled literally "RevenueCat Paywalls"**, with no branding and no
feature copy. Nothing in this repo could change a pixel of it.

**`Code/SettingScreen/OfferWall.jsx` is now a custom paywall**, ported from
`adoptme-jan7` and themed from the SEA scale in `Design/tokens`.
`Code/SettingScreen/PayWall.js` shrank to the offerings cache; its
`handleOpenPaywall()` is gone, and with it the `ENTITLEMENT_ID = 'pro'` hardcode
that never matched this app's `fisch_pro` — **that bug is dead**, because the
custom wall reads `localState.isPro` via `hasProEntitlement()`.

Three things adoptme's version gets away with and this one could not:

- **It pins one dark look.** This app ships a theme switch users actually set, so
  the wall follows the theme. `makePalette(isDark)` + `makeStyles(P)`, rebuilt
  only when `theme` flips. `GOLD_TEXT` is separate from `GOLD` on purpose:
  `#F5B13D` as *text* on a white tile is ~1.9:1.
- **Intl-first money formatting.** Invisible in USD (Intl and Play both say "$"),
  but this account bills PKR, where Intl says "PKR 550.00" and Play says
  "Rs 550.00" — both appeared on one screen. The store's symbol now wins, Intl
  only groups thousands. Play's trailing `.00` is stripped with
  `/([.,])00(?!\d)/`, which leaves a grouped "Rs 1,006.00" its "1,006".
- **`assets/logo.png` is Blox Fruits' BFVC mark** — fork residue, and the only
  logo-looking file in `assets/`. Both this wall and the walkthrough now use
  `assets/brand/bootsplash-logo-*.png`. The filenames read backwards: `-dark` is
  the logo drawn FOR a dark background, so it belongs to dark mode.

### The walkthrough logo was an opaque tile

`OnBoardingScreen.js` used `assets/logo.webp` — the right mark, but baked onto an
opaque square, so it rendered as a card. Now theme-aware and transparent, with
`resizeMode="contain"` and no `borderRadius` (the default `cover` would crop a
portrait logo, and a radius would clip the hook).

### Banner ads: auto height removed

`Code/Ads/bannerAds.js` used `BannerAdSize.ANCHORED_ADAPTIVE_BANNER`, whose height
the SDK derives from device width. Now `BannerAdSize.BANNER`, fixed 320x50.
`BANNER_HEIGHT = 60` still clears it.

**Two caveats.** Google's collapsible format requires an *anchored adaptive* size,
so the `collapsible: 'bottom'` extra that main screens pass will likely now be
ignored — the comments in that file put collapsible at ~2-3x eCPM on the first
impression. `LARGE_ANCHORED_ADAPTIVE_BANNER` is the non-deprecated way to keep it
(GMA SDK 25.0.0 deprecated the older adaptive APIs). And **this was never seen
running**: `GAME.showAdsInDev` is `false`, so debug builds render no banner at all.

### Legal links — wired, but pointing at a domain that does not exist

The paywall footer reads `GAME.termsUrl` / `GAME.privacyPolicyUrl` and renders
each link only when non-null. adoptme hardcodes its URLs in the screen itself and
uses a *third* spelling in its own `settinghelper.js`; it is not a source of truth.

Both keys were null, so the footer showed "Restore" alone. They were then set to
`https://fischvalues.app/terms` and `/privacy` **so the links render** — but
checked 2026-09-18, `fischvalues.app`, `fischvalues.com` and `fischvaluescalc.com`
all fail to resolve.

**2026-09-23:** `privacyPolicyUrl` is now the owner's
`https://thesolanalabs.com/fisch/privacy` (page not published yet — the owner
will put it live). Every consumer reads it from `game.js`: Settings no longer
hardcodes Adopt Me's policy, and the chat rules no longer print the literal
`${GAME.privacyPolicyUrl}` (translations use `{{privacyUrl}}`, passed by
`ChatRuleModal`). `termsUrl` is still the fischvalues.app placeholder, and
Settings' child-safety row still opens Adopt Me's page. See the Legal block in
`Code/config/game.js`.

## 24. Known issues and what is left

Verified against the tree on 2026-09-16, not carried forward on trust.

### Only the owner can clear these

0. ~~**Firebase needs an Android app for `com.fischvaluescalc`**~~ **Done.**

   **The Android package was renamed on 2026-09-16.** `com.fischvalues` could
   not be used: Play reported it taken while returning 404 publicly, so it is
   held by somebody else's **unpublished** app. Play reserves a package name the
   moment any app entry claims it and **never releases it** — not on deletion,
   not to anyone. Renamed before the first upload, the only time this is cheap.

   Changed in code: `applicationId` + `namespace` (`android/app/build.gradle`),
   `rootProject.name` (`android/settings.gradle`), the Java package directory
   `com/fischvalues/` -> `com/fischvaluescalc/` with both `.kt` package
   declarations, `PRODUCT_BUNDLE_IDENTIFIER` x2 in `project.pbxproj`, and
   `GAME.bundleId` + `GAME.store.android` in `game.js`. **iOS was renamed too**
   — Apple's namespace is separate and did not force it, but the owner
   registered both, so the two platforms match.

   Both config files were reissued and installed: `google-services.json` and
   `GoogleService-Info.plist`, project `stealanegg-5ac52` throughout.

   > **Google Sign-In then failed with `DEVELOPER_ERROR` anyway, and the reason
   > is not obvious.** Play App Signing means Google **re-signs** the app: you
   > sign the AAB with the *upload* key, Play strips that and re-signs delivered
   > APKs with the *app signing* key. Firebase had the upload key's SHA-1 and
   > had never seen the one the installed app actually carries.
   >
   > Worse, this app is enrolled in Play's **Quantum-ready (beta)** signing, so
   > the App signing key panel shows *hybrid* certificates — and **neither is
   > the one that signs delivered APKs.** The correct fingerprint only appears
   > in Play Console's downloaded certificate bundle, as `deployment_cert.der`:
   > `F8:15:02:2A:88:5C:A6:95:DF:BC:F2:4C:71:F2:FF:52:A6:B9:BB:30`.
   >
   > Registering that SHA-1 fixed sign-in, with no rebuild — the match is made
   > server-side. Note Firebase creates an Android OAuth client from a **SHA-1**
   > only; adding a SHA-256 does nothing for Google Sign-In.
   >
   > Every sibling app distributed through Play has the same split waiting.

1. **The privacy page is not live and `termsUrl` is a placeholder.**
   `privacyPolicyUrl` is set to `https://thesolanalabs.com/fisch/privacy`
   (2026-09-23) but that page 404s until the owner publishes it; `termsUrl`
   points at the unregistered fischvalues.app. Both stores refuse a listing whose
   policy link does not load.
2. **AdMob unit IDs and RevenueCat keys are still Blox Fruit's** — flagged with a
   `⚠️ RELEASE BLOCKERS` header in `Environment.js`. This is why the running app
   logs a RevenueCat `ConfigurationError` on every launch; it is expected until
   the real keys land.
3. ~~**Release builds are signed with the DEBUG keystore.**~~ **Done
   2026-09-16.** `solanalab.keystore` — the one upload key shared by every app
   in `RunningApps` — was copied in from `../mm2values/android/app/`, and
   `android/app/build.gradle` now has a real `release` signingConfig.

   Credentials are NOT in this tree. They live in `~/.gradle/gradle.properties`
   as `SOLANALAB_STORE_FILE` / `_STORE_PASSWORD` / `_KEY_ALIAS` /
   `_KEY_PASSWORD` — named for the KEY, not for this app, so one entry serves
   all five forks. That file is mode 600 and was created by this session; a new
   machine needs it written by hand or no release build will sign.

   **The properties deliberately have no fallback.** A missing property
   resolves to an empty string and the build fails at signing, rather than
   silently falling back to `signingConfigs.debug` — Play binds a package to
   the first key it ever sees, permanently, so a debug-signed upload is not a
   mistake you get to undo.

   Verified: the keystore's SHA-1 is
   `D1:95:A1:22:F9:1D:23:F1:B1:AD:22:21:FC:CB:F0:99:93:08:7A:F1`, and the
   `google-services.json` issued for `com.fischvaluescalc` carries it alongside
   the debug `5e8f1606…`. Google Sign-In survives a release build.

   > **Disk — the real cause, and the fix.** Three release builds were lost to
   > this before it was diagnosed properly. Section 16.2 blames a full disk and
   > prescribes `rm -rf ~/.gradle/caches`; that prescription is **wrong** and
   > costs an hour. The build re-downloads most of the cache immediately, so
   > you free 6 GB and the next build takes it straight back.
   >
   > The actual condition: this Mac's internal disk is genuinely full —
   > `/System/Volumes/Data` at **187 GB used**, APFS container free space down
   > to **198 MB**. A ProGuard release build of this app writes several GB into
   > `~/.gradle`, which grew 5.8 GB -> 9.8 GB across two attempts and then
   > stalled the machine, not just the build.
   >
   > **Fixed 2026-09-16 by relocating the cache, not deleting it:**
   > `~/.gradle/caches` is now a symlink to
   > `/Volumes/Sohail/gradle-home/caches` (671 GB free). Builds no longer touch
   > the internal disk. `~/.gradle/gradle.properties` deliberately stayed on
   > the internal disk — the signing password should not live on a removable
   > volume. **If `/Volumes/Sohail` is not mounted, every Gradle build fails**;
   > that is the trade, and the projects are on that volume anyway.
   >
   > Two failure modes seen on the way, so they are not re-diagnosed:
   > a transient DNS drop reads as
   > `dl.google.com: nodename nor servname provided` and is nothing to do with
   > disk — just retry. And `./gradlew … | tail` reports the **pipeline's**
   > exit code, so a failed build looks like exit 0; redirect to a log and read
   > `$?` instead.
   >
   > Still available if more room is ever needed: the emulator's
   > `~/.android/avd/Pixel9_API35_ARM.avd/userdata-qemu.img.qcow2` is **16 GB**
   > (deleting it factory-resets that AVD), and `~/Library/Android` is 10 GB of
   > SDK/NDK that must stay. The `android/app/build` dirs — 21 GB across the
   > five apps — are on `/Volumes/Sohail` and free nothing on `/`.

### Engineering, in priority order

1. **iOS has never been built.** Bundle id and `GoogleService-Info.plist` are
   now correct (`com.fischvaluescalc`), but `project.pbxproj` has **0** Lato
   references, so the fonts are not in Resources — iOS would ship the unbold
   headings Android had before section 11. Largest untouched piece of work.
2. **Trade, Feed and Chat are unexercised.** Inherited from MM2 and deployed,
   but never driven end-to-end against Fisch data. Their bottom sheets got the
   safe-area fix in section 22 but the flows themselves are untested.
3. **15 of 78 style keys in `ValueScreen` are duplicated** — `filterText`,
   `icon`, `itemBadge`, `badgeButton`, `imageWrapper`, `itemInfo` and nine more.
   The later definition silently wins, so editing the first does nothing. Same
   defect as the `selectedOption` duplicate in section 18. **A trap for whoever
   next tries to restyle that screen.**
4. **9 user-facing "pets" strings** remain across five translation files —
   `selected_pets`, `owned_pets`, `limit_pets`, `pets_count_plural`, "up to 18
   pets in a message", and the onboarding subtitle "Track pets values &
   optimize your trades." Adopt Me copy in a fishing game, on the first screen
   a new user sees.
5. **"Remove Ads" is unreadable** — `rewardGold` (`#C8891B`) on a dark brown
   tint. A contrast failure, visible on the Calculator in every screenshot.
6. **Create / Log / Share Trade are three different colours** for peer actions.
   Pick one treatment and promote at most one.
7. **~1,380 hex literals remain** across `Code/`, concentrated in files whose
   stylesheets sit at module scope and so cannot reach the theme. Note
   `shopItems.js` and `MysteryEgg.js` are **content data, not chrome** — do not
   tokenise those.
8. **~450 items have no value anywhere** — 340 bobbers (7% covered), 111
   lanterns (14%). A real gap in community pricing, not a bug; section 7
   explains why it must not be filled by inference. A second source is the only
   honest route and needs a robots.txt review first.
9. **The English-only UI strings** added in sections 14 and 22
   (`home.search_values`, `home.rods`, `home.timers`, `home.fish_value`, the
   four `_sub` subtitles, `home.fish_cash_total`, `home.ranked_not_summed`)
   exist only as `defaultValue`s. Non-English users see English.

### Fixed this cycle — do not re-report

**Earlier cycles:** the splash logo, the launcher icon, the Blox Fruits "BFVC"
in-app logos, the MM2 pink/purple cosmetics cards, the unbold headings, the
filter freeze, the false WIN verdict, every `fontWeight`, the codes drawer, fish
values, the My Stuff save bug.

**2026-09-18:** the hosted paywall (section 23) and with it the `'pro'`
entitlement hardcode, the Blox Fruits logo on the paywall, the opaque walkthrough
logo, the PKR/Rs currency split, and banner auto-height.

**Previous cycle:** release signing (section 21's blocker 3), every cross-promo row
(19), the package rename to `com.fischvaluescalc` (20), the broken x86 split
(20), the stale autolinking codegen (20), the ProGuard launch crash (21), and
the whole of the UI pass (22) — safe area app-wide, calculator filter wrapping,
the fish C$ line, forced AdMob test units, the duplicate splash, the scale-aware
unpriced labels, the stale `valueSource` closure, and the Proto "Unpriced"/zero
reporting.

Each has its own section above.
