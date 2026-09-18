# Steal an Egg — data plan

Research date **2026-09-14**. Written before any data code is committed, because three
of the decisions below (no codes, no scripts, no trade calculator) delete features the
ported MM2 `Code/` currently ships.

Method: read `HANDOFF.md` → read the Google Trends query lists (top 50 + rising 50,
worldwide, past month) → web research, cross-checking every number against at least two
independent sources and preferring ones that name a human author or expose an edit history.

---

## 0. The seven decisions, in one table

| # | Question | Answer | Confidence |
|---|---|---|---|
| 1 | What is the authoritative "value"? | **Money-per-second from the in-game Pet Index.** Not a community value list — the game publishes the number itself. | High — two independent sources agree exactly on 28/29 sampled pets |
| 2 | Where do we scrape it? | **`stealanegg.fandom.com` MediaWiki API** (primary, structured + art), **IGN wiki** (cross-check + gap fill) | High |
| 3 | Do we ship codes? | **No codes exist. The game has no redeem box at all.** Ship a "no codes yet" screen + notify-me, not an empty list. | Very high — 4 independent sources |
| 4 | Do we ship scripts? | **No. Never.** Exploit code; store-policy and Roblox-ToS violation. ~10 of the top-50 queries, and we forfeit all of them. | Certain |
| 5 | How does the trade calculator work? | **It doesn't — the game has no trade window.** No 3v3/4v4. Gifting is one item, one player, proximity, irreversible. | High — 3 sources incl. an editor-verified one |
| 6 | So what replaces it? | **Income calculator** (base × size × mutation), **Fuse calculator** (3→1), **Pen planner** (N slots) | — |
| 7 | What is the killer feature? | **Admin Abuse + weekly update countdown.** Weekly, scheduled, 100% BREAKOUT search growth, trivially accurate. | High |

---

## 1. The game, as it actually is

Facts that constrain every feature decision below.

- **Scale.** 3.33 B visits, 4.06 M favourites, ~2.0 M concurrent at time of writing, all-time
  peak ~9.87 M CCU, 92.8 % rating. Created ~mid-August 2026 — **about one month old**.
- **Loop.** Steal a guarded egg from a biome → outrun the Guardian back to your base →
  hatch it into a pet → the pet earns money/second from a pen slot → spend on Treadmill
  Speed → Speed unlocks the next biome. Speed is the whole progression axis.
- **Speed gates the map** (Fandom Zones, community-documented, marked uncertain for
  Jungle/Prehistoric):

  | # | Biome | Speed required | Guardian |
  |---|---|---|---|
  | 1 | Forest | none | Chicken |
  | 2 | Lake | 900 | Swan |
  | 3 | Desert | 10,000 | Scorpion |
  | 4 | Jungle | ~40,000 | Tiger |
  | 5 | Snow | ~170,000 | Yeti |
  | 6 | Volcano | ~700,000 | Hellhound / Cerberus |
  | 7 | Abyss Ocean | ~2,500,000 | Beluga Whale |
  | 8 | Prehistoric | ~17–18 M | T-Rex |
  | 9 | Cosmic | 700 M | Cosmic Skeleton King |
  | 10 | Cherry Blossom | 2.5 B | Oni Tiger |
  | 11 | Titan Temple | 7 B | Gorilla King |
  | 12 | Angels & Demons | ~20 B | (nightly Angel/Demon/merged) |

- **Eggs reset on a short cycle.** IGN says every in-game night ≈ **4.5 min**; most other
  sources say **5 min**, then the map closes 13 s. *We do not know which. Do not publish a
  live countdown until we time it ourselves.*
- **Updates are weekly**, Saturday, immediately after **Admin Abuse** (a 30–60 min all-server
  event where devs spawn items and stack boosts). Latest: **Update 4 "Angels vs Demons",
  2026-09-12**, 11:00 ET / 08:00 PT.
- **Monetisation is Robux-direct**: Monster Eggs 99 R$ (1) / 249 (3) / 799 (10) / 3,499 (50);
  gamepasses (x2 Money 399 R$, x2 Growth Speed 467 R$); Robux speed multipliers x2→x4K
  (3 → 1,375 R$).
- **Platform risk is real**: Roblox delisted the game for roughly a day on 2026-08-25 over the
  treadmill in-game video-feed ("doom-scrolling") mechanic, then reinstated it. A companion
  app should not lean on any one mechanic surviving.

---

## 2. What the 100 trending queries are actually asking for

Clustered from the two Trends panels (worldwide, past month). Percentages are share of the
100 queries, not volume.

| Cluster | ~Queries | Intent | Can we serve it? |
|---|---|---|---|
| **Eggs / pets / index** | 22 | "all eggs", "best egg", "steal an egg index", "egg types" | ✅ **Core.** This is the app. |
| **Scripts / executors** | 14 | delta, xeno, solara, speed hub, cloverhub, omg hub, lennon script, auto clicker, "hack", "auto steal" | ❌ **Refuse.** See §4. |
| **Codes** | 10 | "codes steal an egg", "code in steal an egg roblox 2026" | ⚠️ **Serve the truth** — there are none. §3. |
| **Wiki / guide** | 7 | "steal an egg wiki", "wiki fandom", "guide" | ✅ Guides + index. |
| **Admin abuse** | 5 | "when is admin abuse", "admin abuse time" | ✅ **Countdown. Highest-value feature.** |
| **Prediction / spawn / stock** | 8 | "predictor", "spawn time", "steal an egg stock", "prediction" | ⚠️ Partly — see §6, honest-timer only. |
| **Named pets/eggs** | 6 | crane, kitsune, dodo, red panda, bigfoot, flyswatter | ✅ Deep-link per-pet pages. |
| **Discord** | 5 | "steal an egg discord server" | ✅ One verified link. |
| **Trading / calculator / gifting** | 4 | "calculator", "how to gift in steal an egg" | ✅ **Reframed** — §5. |
| **Misc** | 19 | "roblox download", "time", "what happened to steal an egg" | partial |

Two things to read off this table:

1. **"Time" is the strongest rising signal.** "steal an egg time" +140 %, "all eggs" +140 %,
   "all egg" +130 %, "best egg" +100 %, "eggs" +80 % — plus every admin-abuse and
   predictor query at BREAKOUT. People want *when* and *what's best*, more than *what's it worth*.
2. **~24 % of demand (scripts + codes) is demand we cannot honestly satisfy.** Better to
   know that now than to discover it after building a codes tab.

---

## 3. Source audit — what is authentic and what is invented

The reason this document exists. Steal an Egg is one month old and enormously searched, so
the SERP is saturated with AI-generated "wiki" sites. Several publish confidently wrong numbers.

### Tier A — use these

| Source | What it gives | Why trusted |
|---|---|---|
| **`stealanegg.fandom.com`** (MediaWiki API) | 190 pages, **134 with a structured `{{Detail}}` infobox**: `pet_name, pet_image, egg_name, egg_image, rarity, rarity_class, biome, mps, reward, grow_time`. Plus Zones, Mutations, Boosts, Gamepasses, Updates. Art: 1024×1024 pet PNGs, 1254×1254 egg PNGs on `static.wikia.nocookie.net`. CC-BY-SA. | Public edit history (active 2026-08-15 → today), community-verified, machine-readable, **and it carries the art we otherwise have no source for** |
| **IGN wiki** (`ign.com/wikis/steal-an-egg-roblox`) | **149 pets** with biome / rarity / money-per-second / rewards; **all eggs with drop-rate %** for Monster, Void/Rift and Luminous eggs; Robux prices | Named authors, updated 2026-09-14, and it **states what it does not know** instead of guessing |
| **In-game Pet Index ("All Items")** | The ground truth both of the above copy: every pet's money/s and weight | It is the game |
| **GameBoost blog** | Gifting/trading mechanics | Named author + named verifier, dated |

**The cross-check that matters:** I sampled 29 pets across every biome and compared Fandom's
`mps` to IGN's money/s. **28 agreed exactly**; 1 (Unicorn) is missing an infobox on Fandom.
Two sources that never copy each other agreeing to the digit means both are reading the
in-game Index. That is our value pipeline.

### Tier B — cross-check only

Eldorado, Timesaver, games.gg, Sportskeeda, Pro Game Guides. Real editorial, but they go stale
fast: games.gg (Sep 8) still lists **78 pets / 8 biomes** when the Sept 12 update put the count
at ~149–157 across 12 biomes. Useful for events and context, not for the catalogue.

### Tier C — do not use

The generated look-alikes: `stealanegg-roblox.wiki`, `stealanegg.pro`, `stealaneggwiki.net`,
`steal-anegg.wiki`, `stealanegghelp.wiki`, `stealaneggguide.wiki` and a dozen more. Two
concrete examples of why:

- **`stealaneggcalcuator.com`** — its Fuse calculator's preset pets are **Chick, Barn Cat, Hare,
  Marsh Heron, Sand Cobra, Frost Lynx**. *None of these pets exist in the game.* It also invents
  a trading value as `CPS × 15`, "calibrated against the Axolotl example" — one data point.
- **`stealegg.co/calculator`** — publishes mutation multipliers Silver ×1.1, Golden ×1.2,
  Rainbow ×2. `stealaneggcalcuator.com` publishes Silver ×1.25, Golden ×2, Rainbow ×2.5.
  Fandom publishes Silver ×1.2, Golden ×2.5, Rainbow ×3.5. **All three disagree.**

### The mutation-multiplier problem, resolved

This is the one number every competitor gets wrong, and it is checkable:

- **IGN refuses to publish multipliers** and says why: they measured a **Silver T-Rex at +20 %**
  and a **Silver King Snake at +17 %**, and attribute the gap to pet weight.
- **Fandom lists Silver at ×1.2** — exactly IGN's T-Rex measurement.
- The SEO sites' ×1.25 matches neither.

So: **Fandom's table is corroborated by the only source that actually measured.** Use it, and
show the size term that explains the residual — because Fandom also publishes the
reverse-engineered income formula:

```
below 125× base weight:
  money/s = base × (actualWeight / baseWeight)^(37/60) × mutationMultiplier

at or above 125× base weight (diminishing returns):
  money/s = base × mutationMultiplier × (actualWeight / baseWeight)^(2/5) × 125^(13/60)
```

Sanity anchors from that formula: 100× base weight ≈ 17× base value, 200× ≈ 23×, 1000× ≈ 45×.

Mutation table to ship (Fandom, edited 2026-09-13) with roll weights where known:

| Mutation | Multiplier | How |
|---|---|---|
| Rainbow | ×3.5 | hatch roll, weight 1/100 |
| Parasite | ×3 | Parasite Egg, feeding event only |
| Fractured | ×2.75 | not a normal roll — **Mutation Consumable, 10 % chance** |
| Golden | ×2.5 | hatch roll, weight 4/100 |
| Spirit Bloom | ×2.5 | Sakura Incubator only (5 %, 10 % at max charge) |
| Bloom | ×1.25 | Sakura event |
| Silver | ×1.2 | hatch roll, weight 6/100 |

Size is a separate roll shown as kg on the pet card; example combos Golden+Giant = ×7.5,
Rainbow+Huge = ×17.5.

> Ship every one of these behind a confidence label. `valueConfidence` already exists in the
> feed shape we inherited — reuse it: `observed` (in-game Index), `community` (Fandom/IGN
> measured), `estimated` (formula-derived), `unknown` (render the reason, never a 0).
> We know from MM2 that a labelled "Award only" beats a fake number.

---

## 4. Scripts — the answer is no, and here is the reasoning written down

~14 of the top-50 queries are executors and script hubs: **delta, xeno, solara, speed hub,
cloverhub, omg hub, lennon script, auto clicker, "hack", "auto steal", "script bigfoot"**.
These are Lua exploit payloads run through injectors on a modified Roblox client.

Shipping, linking, or even describing how to obtain them costs us:

1. **Google Play — Device and Network Abuse.** Explicitly prohibits apps that facilitate game
   cheats affecting other apps, and downloading unauthorised executable code.
2. **Apple** — same posture under 2.5.x / 5.x.
3. **Roblox ToS** — script executors get *our users* banned. Our audience is largely minors.
4. **Families policy exposure**, given who plays this.
5. The script sites themselves are the #1 credential-phishing vector in this ecosystem — a
   point GameBoost's own scam section makes.

### What the script pages actually contain (checked 2026-09-14)

`scriptpastebin.com/steal-an-egg-script/` lists 46 "hubs". Every single entry is the same
one-liner — `loadstring(game:HttpGet("<remote url>"))()` — which is not a script at all. It is a
**loader**: it fetches code from someone else's server *at run time* and executes whatever comes
back. The user who copies it cannot see what they are running, and the operator can change the
payload after the fact without changing the one-liner.

Where those payloads live tells the rest of the story: commercial obfuscation-and-auth services
(`luarmor.net`, `flowauth.net`, `jnkie.com`), throwaway GitHub accounts, and one file named
literally `final-obfuscated.lua`. Another points at a file called `mm2.txt` — a Murder Mystery 2
script served under a Steal an Egg heading. "No Key" is the headline selling point because the
keyed hubs route users through link-shortener ad gauntlets first.

Advertised features: Auto Farm, Instant Steal, Place Hatch, Godmode, Freeze Guard, and
**"Pet Egg Prediction"** — i.e. reading live server state, which is the one thing the honest
browser predictors in §6 openly admit they cannot do. That is what the traffic is chasing.

This page also resolves three trending queries: **"bigfoot"** = BIGFROOT HUB, **"cloverhub"** =
CLOVER HUB, **"lennon script"** = LENNON HUB. Same for SPEED HUB and OMG HUB. None are game
content; all are loaders. They do not get index entries.

**What we do instead:** a short, honest *Scam & Safety* page. "Script sites, 'give codes',
and pet spawners are all credential theft — here are the four patterns." It captures a slice
of the search intent, is genuinely useful, and is a trust asset rather than a liability.
Do not put the word "script" in ASO metadata as bait.

---

## 5. Trading — the ported MM2 calculator does not apply

**There is no trade window in Steal an Egg.** No two-sided confirmation, no escrow, no
item-count limit to design around. So the "3v3 or 4v4" question has no in-game answer:

- Gifting is **one item, one player, at melee range**: open inventory → stand near the player →
  select pet or unhatched egg → confirm → it is gone. Instant, free, **irreversible**,
  no level/Speed/time requirement, no cooldown documented, same-server only.
- What players call a "trade" is **two separate one-way gifts**, and nothing holds either item.
- There is **no official value list**, and — GameBoost's words — the established value-tracking
  sites for other pet games **do not cover Steal an Egg at all**.

Consequences for our code:

| Inherited from MM2 | Verdict |
|---|---|
| `HomeScreen` give/receive grid, `GRID_STEPS = [4, 8, 12, 16]` | **Repurpose** into a **Pen Planner**: N slots, sum the money/s, compare loadouts. Same component, honest framing. |
| WIN / FAIR / LOSE verdict + `status` on trade docs | **Remove.** There is no exchange rate to be fair against. Inventing one is exactly what the Tier-C sites do. |
| Demand-gap advisory, `stability`, `demand`, `range` fields | **Remove.** No demand market exists to measure. |
| Trades board + chat | **Keep, reframed** as a **gift / giveaway board** with the scam patterns shown inline. Social demand is real ("how to gift in steal an egg" is BREAKOUT); the escrow promise is not. |
| Trade screenshot share | Keep — repoint at pen loadouts. |

**The market gap is the opportunity.** Nobody has an accurate Steal an Egg calculator: the two
ranking ones invent pets and disagree on every multiplier. An income calculator built on the
in-game Index plus Fandom's weight formula would be the only correct one.

Three calculators to ship:

1. **Income calculator** — pet × size(kg) × mutation → money/s. The formula above.
2. **Fuse calculator** — 3 identical pets → 1. Worth it only if fused money/s beats
   3 × base, *or* the pen is full and the freed 2 slots earn more. Fuse rolls mutations, so
   never fuse a good size/mutation roll.
3. **Pen / Treadmill planner** — "next slot vs next treadmill tier", against the real Speed
   gates in §1 (the competitor's version stops at Cosmic 700 M and misses the top three biomes).

---

## 6. Codes and predictions — serve the honest answer

**Codes.** Four independent sources agree: **the game has never shipped a redeem box.**
PCGamesN (Sep 14): "there isn't a Steal An Egg code redeem box in the game just yet."
Pocket Tactics (Sep 7). GameBoost. And the Fandom Codes page, in full: *"There are no current
codes in this game. There is not even a way to redeem them."*

So `CodesDrawer` must not ship an empty list. Ship instead:
- a clear "**No codes exist yet — and there's no redeem box in the game**" state,
- **the real freebie**: like + favourite the game + join the group → **10,000 Speed** from the
  chest near the Trail Shop,
- a **notify-me** toggle wired to the push we already have, and
- a warning that any site asking you to enter a "give code" is a scam.

That page is genuinely the best answer on the internet for 10 % of the search demand, and it
costs one screen.

**Predictions / spawn timers / "stock".** Every predictor site is a manual countdown: you type
in when you last saw a spawn, it counts. None of them read game state — they say so
themselves. Meanwhile the community is split on the base cycle (4.5 min vs 5 min), and rare
spawns are explicitly random on reset. And "stock" appears to be borrowed vocabulary from
Grow a Garden — **Steal an Egg has no restocking shop**; the Rift banner rotates every 3 hours
and that is the only fixed rotation found.

Ship, in order of how defensible they are:

1. **Admin Abuse + weekly update countdown** — real, weekly, Saturday, timezone-localised. ✅
2. **Rift banner 3-hour rotation.** ✅
3. **Personal egg-cycle timer** — user taps "spawned now", we count. Labelled as *your* timer,
   not a prediction. ⚠️
4. **A server-state "predictor"** — we cannot build it. Do not imply we can. ❌

Time the egg reset ourselves before shipping #3.

---

## 7. Proposed data structure

Keep the inherited `{ meta, data }` envelope — `unwrapFeed`/`feedMeta` in
`Code/Helper/valueSources.js` already handle it, and `generatedAt` (scraper time, not fetch
time) is the honesty feature we learned in MM2. Change what is inside it.

```jsonc
{
  "meta": {
    "source": "stealanegg.fandom.com + ign.com",
    "generatedAt": "2026-09-14T…Z",
    "gameUpdate": "Update 4 — Angels vs Demons",   // so the app can say "current as of"
    "biomes": 12, "pets": 149,
    "observed": 134, "community": 15, "unknown": 0
  },
  "data": {
    "Cherry Blossom": {                              // group by BIOME, not by rarity
      "Divine": [{
        "name": "Kitsune",
        "egg": "Kitsune Egg",
        "image": "pets/kitsune.webp",                // mirrored to our own Bunny zone
        "eggImage": "eggs/kitsune-egg.webp",
        "rarity": "Divine",
        "biome": "Cherry Blossom",
        "mps": 1800000000,                           // number, for sorting/maths
        "mpsText": "$1.8B/s",
        "hatchTime": "14h",
        "hatchSeconds": 50400,
        "rewardSpeed": 6500000,
        "rewardCash": 180000000000,
        "dropRate": null,                            // only Monster/Rift/Luminous publish these
        "speedRequired": 2500000000,
        "source": "fandom",
        "confidence": "observed"
      }]
    }
  }
}
```

Alongside the catalogue, three small static feeds — same envelope, same CDN, so they update
without an app release:

- `mutations.json` — name, multiplier, rollWeight, howObtained, confidence
- `biomes.json` — order, speedRequired, guardian, confidence (Jungle/Prehistoric = `community`)
- `events.json` — admin abuse schedule, update cadence, rift rotation, current event

**Keep from the MM2 shape:** `name`, `image`, `confidence` semantics, the `{meta,data}` wrapper.
**Drop:** `demand`, `range`, `stability`, `valueType`, the second "Supreme" source and its whole
name-reconciliation layer — there is one catalogue here, not two disagreeing ones.
**Add:** `biome`, `mps`, `hatchTime`, `rewardSpeed`, `rewardCash`, `dropRate`, `speedRequired`.

**Scraper shape.** Not cheerio-on-HTML like `scraper.js` today. Instead:

1. `GET /api.php?action=query&list=allpages` → page titles
2. batch `prop=revisions&rvslots=main` → wikitext → regex the `{{Detail}}` block (the parse
   is ~15 lines; already prototyped and it works on all 134)
3. `prop=imageinfo` → real image URLs → download, convert to webp, push to our Bunny zone
4. fetch IGN's All Pets / All Eggs tables → fill `dropRate`, and flag any `mps` that disagrees
5. **fail the build if the two sources disagree on more than N pets** — that is the signal that
   an update landed and the wikis haven't caught up

**Cadence:** the game updates weekly on Saturday, and wikis lag it by 1–3 days. Run the scraper
daily; expect real churn only after Saturday.

**Art licensing, stated plainly:** Fandom content is CC-BY-SA, so mirroring requires visible
attribution and share-alike on the derived data. The underlying renders are Roblox/dev assets
that the wiki cannot license to us either way. Attribute the wiki in-app, keep a takedown path,
and know this is the same posture the three sibling apps already run on.

---

## 8. Build order

**Release 1 — the index.** Pet/egg browser: biome → rarity → pet, with art, money/s, hatch
time, rewards, Speed gate. Search + sort. Serves the single biggest query cluster and reuses
`ValuesScreen` almost unchanged. Also: `game.js` filled in, the 116 `bloxfruitscalc.com` URLs
and the "Made with ❤️ for MM2 traders" footer removed (per `HANDOFF.md` §Inherited residue).

**Release 2 — the timers.** Admin Abuse + weekly update countdown, timezone-aware, with push.
Rift 3-hour rotation. Small, high-value, and no competitor app owns it.

**Release 3 — the calculators.** Income (size × mutation), Fuse, Pen/Treadmill planner.
The differentiator: correct where the ranking sites are provably wrong.

**Release 4 — social.** Gift/giveaway board (reframed Trades), scam-safety page, codes
"none yet" + notify, verified Discord link.

---

## 9. Open questions

1. **Egg reset cycle: 4.5 or 5 minutes?** Sources conflict. Time it in-game before any timer ships.
2. **Which Discord invite is official?** At least three compete. Read it off the Roblox game page
   itself, not from an SEO site.
3. **The 15-pet gap** — IGN lists 149, Fandom's infobox covers 134 (Unicorn among the missing).
   Decide: fill from IGN, or ship 134 and let the scraper close the gap as the wiki grows?
4. **Does the trade/gift board survive review?** The game is played mostly by minors and has no
   escrow. A giveaway board may attract exactly the scams we warn about — worth deciding
   whether it ships at all, or ships read-only.
5. ~~**`bigfoot` / `flyswatter`**~~ **Resolved 2026-09-14.** Flyswatter is a bat-skin weapon from
   the Monster Chest (5 %) — index it. "bigfoot" is **BIGFROOT HUB**, a script loader, not a game
   entity — do not index it. See §4.
6. **Weapons and events are uncovered ground** — Bee Gun, bear traps, Hungry Monster, Parasite
   Egg, Secret Fusion Shrine. Not in the trends top-100 yet, but they are where the game is going.
