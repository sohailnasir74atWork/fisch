/**
 * tokens.js — the single source of truth for how this app looks.
 *
 * Why this exists: the app arrived with 2,490 hardcoded hex colours (390
 * distinct), 211 rgba() literals and 824 fontSize declarations spanning 27
 * different sizes, spread across 57 local StyleSheets. Nothing was wrong with
 * any one of them; the incoherence came from there being no shared vocabulary.
 * That is what makes a screen feel "not symmetric" even when every element is
 * individually fine.
 *
 * Rule: no file under Code/ should contain a raw hex, a raw fontSize, or a raw
 * spacing number. Import from here.
 *
 * ── Two font bugs this replaces ───────────────────────────────────────────
 *
 * Only Lato-Bold.ttf and Lato-Regular.ttf are bundled, yet the code asked for
 * `Lato-Bold` in 10 places and `Lato-Ragular` (a typo) in one. React Native
 * does not warn — it silently substitutes the system font. So a tenth of the
 * app's emphasised text was already rendering in a different typeface than the
 * rest, which is exactly the kind of thing that reads as sloppiness without
 * being locatable. FONT below exposes only faces that actually exist.
 */

// ── Typeface ───────────────────────────────────────────────────────────────
// Only what is in assets/fonts. Adding a weight means shipping the .ttf first.
/**
 * FONT — the app has exactly TWO faces, and that is the whole weight ladder.
 *
 * Only Lato-Regular and Lato-Bold are shipped (checked across every sibling
 * project: no SemiBold or Black exists anywhere). So `fontWeight` is not a tool
 * available to this app, and using it was actively harmful:
 *
 *  - 391 style blocks set `fontWeight` with NO `fontFamily`, which renders in
 *    the SYSTEM font (Roboto). Lato and Roboto were being drawn side by side on
 *    the same screen across seven different weights.
 *  - Worse, the headings did the opposite of what they intended: `TYPE.title`
 *    sets `fontFamily: FONT.bold` and no weight, and because the Lato files
 *    were never bundled into the Android build, every heading fell back to
 *    SYSTEM REGULAR while incidental `fontWeight: '800'` labels rendered bold.
 *    The hierarchy was inverted.
 *
 * Always set a family, never a weight. 700+ is bold; 400-600 is regular.
 */
export const FONT = {
  regular: 'Lato-Regular',
  bold: 'Lato-Bold',
};

/**
 * Type scale. Eight steps replacing twenty-seven ad-hoc sizes.
 *
 * Ratio is roughly 1.2 (minor third) — close enough to the sizes already in
 * use that nothing shifts jarringly, far enough apart that each step reads as
 * deliberate. `lineHeight` is baked in because leaving it to each call site is
 * how vertical rhythm got lost in the first place.
 */
export const TYPE = {
  // Sizes are fitted to how this app already reads, not to a theoretical
  // ratio. The audit found 824 declarations across 27 sizes, but the mass sits
  // between 10 and 16pt (12pt alone is used 121 times). A textbook 1.2 scale
  // would have pushed most body copy up three points and reflowed every
  // screen for no benefit, so each step here snaps to a size the app already
  // favours and absorbs its neighbours.
  //
  //   6,7,8,9 -> 10   10,11 -> 11   12,13 -> 12
  //   14,15   -> 14   16..19 -> 16  20,22 -> 20   24..28 -> 24
  //
  // Anything above 28pt is left alone: those are deliberate hero numbers
  // (a portfolio total, a splash figure), not body copy that drifted.
  display: { fontSize: 32, lineHeight: 38, fontFamily: FONT.bold },
  title:   { fontSize: 24, lineHeight: 30, fontFamily: FONT.bold },
  heading: { fontSize: 20, lineHeight: 26, fontFamily: FONT.bold },
  subtitle:{ fontSize: 16, lineHeight: 22, fontFamily: FONT.bold },
  body:    { fontSize: 14, lineHeight: 20, fontFamily: FONT.regular },
  callout: { fontSize: 14, lineHeight: 20, fontFamily: FONT.bold },
  caption: { fontSize: 12, lineHeight: 17, fontFamily: FONT.regular },
  small:   { fontSize: 11, lineHeight: 15, fontFamily: FONT.regular },
  label:   { fontSize: 10, lineHeight: 13, fontFamily: FONT.bold, letterSpacing: 0.4 },
};

/** Raw sizes, for the many call sites that set fontSize alone. */
export const SIZE = {
  label: 10, small: 11, caption: 12, body: 14,
  subtitle: 16, heading: 20, title: 24, display: 32,
};

// ── Spacing ────────────────────────────────────────────────────────────────
/**
 * Fitted to the app's real rhythm, measured across 2,052 declarations.
 *
 * A textbook 4pt scale would have been wrong here. The two most-used values
 * are 10pt (311 uses) and 6pt (162), both off a 4pt grid, and the 1-3pt values
 * are almost entirely `gap` and badge padding — optical adjustments where a
 * snap to 4pt would visibly inflate every pill and chip in the app.
 *
 * So: a 2pt base where small adjustments matter, 4pt above 12 where it is
 * layout rhythm. That keeps the scale honest about what the app actually does
 * instead of imposing a grid it has never followed.
 */
export const SPACE = {
  hair: 2,   // icon gaps, badge insets
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,    // the app's most common single value
  xl: 12,
  xxl: 16,
  xxxl: 20,
  huge: 24,
  giant: 32,
};

export const RADIUS = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 };

// ── Palette ────────────────────────────────────────────────────────────────
/**
 * Light-first, and built for Fisch specifically rather than inherited.
 *
 * The app came from a deep-navy "ocean midnight" dark theme. Fisch is a bright,
 * daylight fishing game, so the base is a pale cool white with a hint of water
 * in it, and the ink is a deep sea-blue rather than black — black on white is
 * harsher than anything in the game's own art.
 *
 * Primary is a lagoon teal, distinct from the generic Material blue every
 * Roblox companion app uses. Accent is a warm lure-amber, chosen because it is
 * the complement of the primary: it makes a call-to-action unmissable against
 * an otherwise cool screen without needing to be loud.
 */
const SEA = {
  ink:        '#0B2A36',   // deep sea — primary text
  inkSoft:    '#52707E',   // secondary text
  inkMuted:   '#8AA3AE',   // placeholders, disabled
  surf:       '#FFFFFF',   // cards
  foam:       '#F4F9FB',   // app background
  shallow:    '#E8F1F5',   // section bands, pressed states
  line:       '#DCE8EE',   // borders
  lagoon:     '#0E7C94',   // primary
  lagoonDeep: '#0A5E70',   // primary pressed
  lagoonTint: '#DFF0F4',   // primary-tinted surfaces
  amber:      '#E2841F',   // accent / call to action
  amberTint:  '#FDF0DE',
};

export const LIGHT = {
  bg: SEA.foam,
  bgAlt: SEA.shallow,
  bgElevated: SEA.surf,
  card: SEA.surf,
  cardBorder: SEA.line,
  border: SEA.line,
  divider: SEA.line,

  text: SEA.ink,
  textSecondary: SEA.inkSoft,
  textMuted: SEA.inkMuted,
  textInverse: '#FFFFFF',

  primary: SEA.lagoon,
  primaryPressed: SEA.lagoonDeep,
  primaryTint: SEA.lagoonTint,
  onPrimary: '#FFFFFF',

  accent: SEA.amber,
  accentTint: SEA.amberTint,

  success: '#18794E',
  successTint: '#E4F3EC',
  warning: '#9A6100',
  warningTint: '#FBF0DC',
  danger: '#B4342C',
  dangerTint: '#FBE9E7',

  inputBg: SEA.surf,
  inputBorder: SEA.line,
  overlay: 'rgba(11,42,54,0.45)',
  statusBar: 'dark-content',
  statusBarBg: SEA.foam,
};

/**
 * Dark stays available because the app ships a theme switch and users keep it,
 * but it is derived from the same sea vocabulary rather than being a separate
 * invention — that is why the old build felt like two different apps.
 */
export const DARK = {
  bg: '#0A1A22',
  bgAlt: '#0F2630',
  bgElevated: '#143240',
  card: '#0F2630',
  cardBorder: '#1D3F4E',
  border: '#1D3F4E',
  divider: '#1D3F4E',

  text: '#E6F1F5',
  textSecondary: '#93AEBA',
  textMuted: '#61808D',
  textInverse: '#0B2A36',

  primary: '#3AAFC4',
  primaryPressed: '#2B93A6',
  primaryTint: 'rgba(58,175,196,0.14)',
  onPrimary: '#04222B',

  accent: '#F0A14A',
  accentTint: 'rgba(240,161,74,0.14)',

  success: '#4CC38A',
  successTint: 'rgba(76,195,138,0.14)',
  warning: '#E0A653',
  warningTint: 'rgba(224,166,83,0.14)',
  danger: '#E5766D',
  dangerTint: 'rgba(229,118,109,0.14)',

  inputBg: '#0F2630',
  inputBorder: '#1D3F4E',
  overlay: 'rgba(0,0,0,0.6)',
  statusBar: 'light-content',
  statusBarBg: '#0A1A22',
};

/**
 * Fisch's eleven fish rarities, in the game's own order.
 *
 * Deliberately a progression rather than eleven arbitrary colours: cool and
 * desaturated at the bottom, warming and saturating toward the top, so a
 * player reads relative worth from the colour before reading the word. The
 * two ends are held apart hardest because that is the comparison that matters.
 */
export const RARITY = {
  Trash:     '#8C9BA3',
  Common:    '#6E8794',
  Uncommon:  '#2E8B64',
  Unusual:   '#2F7EA8',
  Rare:      '#2D5FC4',
  Legendary: '#7A4FD1',
  Mythical:  '#B13BB8',
  Exotic:    '#D2337A',
  Secret:    '#D2691E',
  Relic:     '#B8860B',
  Fragment:  '#7A8B94',
};

/** Trade signals. These carry meaning, so they must not be decorative. */
export const DEMAND = {
  'Very Low': '#8AA3AE',
  Low: '#6E8794',
  Medium: '#2F7EA8',
  High: '#18794E',
  'Very High': '#0E7C94',
};

export const TREND = {
  Stable: '#52707E',
  Rising: '#18794E',
  Dropping: '#B4342C',
  Hoarded: '#9A6100',
  Manipulated: '#B13BB8',
};

/**
 * Elevation. Android ignores shadow* and iOS ignores elevation, so both are
 * set together — specifying one is the usual reason a card looks flat on one
 * platform and not the other.
 */
/**
 * ACCENT — a small, fixed set of hues for distinguishing peer destinations.
 *
 * The Home screen read as "very white" because every surface used the one
 * primary. Colour here is *information*: each tool keeps its own hue so the
 * grid is scannable by colour before it is read, and a returning user reaches
 * for position + colour rather than re-reading four labels.
 *
 * Every `color` is dark enough to pass as text/icon on its own light tint, and
 * each carries a dark-mode tint so the same token works in both themes — a
 * pale tint on a dark card is what made the old MM2 cards glow.
 *
 * These are hues for CHROME. Rarity colours stay in RARITY; they mean something
 * different and must not be reused for decoration.
 */
export const ACCENT = {
  //         light-mode ink   light tint   dark-mode ink   dark tint
  lagoon: { light: '#0E7C94', tintLight: '#DDEFF3', dark: '#4FB8CE', tintDark: '#0E3A45' },
  coral:  { light: '#C2453F', tintLight: '#FBE6E4', dark: '#EC8B84', tintDark: '#48201E' },
  amber:  { light: '#B06E12', tintLight: '#FBEFDB', dark: '#E3A445', tintDark: '#41300F' },
  violet: { light: '#6247B5', tintLight: '#EAE5F8', dark: '#A692EC', tintDark: '#282050' },
  kelp:   { light: '#237A55', tintLight: '#DFF1E8', dark: '#5EC395', tintDark: '#123A2A' },
  rose:   { light: '#B33A72', tintLight: '#FAE4EE', dark: '#E883B0', tintDark: '#3F1A2D' },
};

/**
 * Resolve an accent for the active theme. Unknown names fall back to lagoon.
 *
 * Dark mode needs a LIGHTER hue, not the same hue on a darker tint: measured,
 * the light-mode inks sat at 2.19-3.07 contrast on their own dark tints, which
 * is unreadable. The `dark` variants measure 5.3-5.9 on both the dark tint and
 * the dark card.
 */
export const accentFor = (name, isDark) => {
  const a = ACCENT[name] || ACCENT.lagoon;
  return {
    color: isDark ? a.dark : a.light,
    tint: isDark ? a.tintDark : a.tintLight,
  };
};

export const SHADOW = {
  none: {},
  sm: {
    shadowColor: SEA.ink, shadowOpacity: 0.06, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  md: {
    shadowColor: SEA.ink, shadowOpacity: 0.08, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  lg: {
    shadowColor: SEA.ink, shadowOpacity: 0.12, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
};


/**
 * Status colours, theme-independent.
 *
 * These were spread across 34 files as 27 near-identical hexes — five reds,
 * eight greens, seven ambers — so "error" looked slightly different depending
 * on which screen you were on. One value each now. They do not change between
 * light and dark because meaning should not shift with the theme; only the
 * surfaces behind them do.
 */
export const STATUS = {
  danger: LIGHT.danger,
  success: LIGHT.success,
  warning: LIGHT.warning,
  primary: LIGHT.primary,
};

export const rarityColor = (r) => RARITY[r] || RARITY.Common;
export const demandColor = (d) => DEMAND[d] || DEMAND.Low;
export const trendColor = (t) => TREND[t] || TREND.Stable;

export default { FONT, TYPE, SIZE, SPACE, RADIUS, LIGHT, DARK, RARITY, ACCENT, accentFor, DEMAND, TREND, SHADOW, STATUS };
