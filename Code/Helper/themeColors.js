/**
 * themeColors.js — the runtime view of Code/Design/tokens.js.
 *
 * Every colour now derives from the tokens. This file's job is only to pick
 * light or dark and to keep the key names its callers already use, so adopting
 * the new palette did not require touching call sites.
 *
 * The old file hand-wrote two palettes and pulled a third set of values out of
 * Helper/Environment.js, which is how the app ended up with 390 distinct
 * hexes. If you need a colour that is not here, add it to tokens.js — not to
 * this file, and never to a component.
 *
 * Usage:  const c = useThemeColors();   // c.bg, c.text, c.primary …
 *         const c = getThemeColors(isDark);
 */

import { useMemo } from 'react';
import { useGlobalState } from '../GlobelStats';
import { LIGHT, DARK, RARITY, DEMAND, TREND, SHADOW, TYPE, SPACE, RADIUS, FONT } from '../Design/tokens';

/**
 * Build the full key surface from a base palette.
 *
 * Several keys here are aliases kept for compatibility — `error` alongside
 * `danger`, `cardBg` alongside `card`. Removing them would be tidier and would
 * also break files at runtime rather than at build time, which is the worst
 * trade available.
 */
const expand = (p, isDark) => ({
  ...p,

  // Legacy aliases — same colour, older names still in use across the app.
  cardBg: p.card,
  error: p.danger,
  info: p.primary,
  secondary: p.accent,
  primaryMuted: p.primaryTint,
  bgAccent: p.primaryTint,
  borderLight: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(11,42,54,0.05)',
  borderAccent: p.primary,
  inputText: p.text,
  placeholder: p.textMuted,

  // Chrome
  navBarBg: p.bgElevated,
  navBarStyle: isDark ? 'light-content' : 'dark-content',
  closeBg: p.bgAlt,
  closeIcon: p.textSecondary,

  // Tags / pro badge
  tagBg: p.primaryTint,
  tagText: p.primary,
  proBg: p.accentTint,
  proBorder: p.accent,
  proText: p.accent,

  // Footer
  footerLink: p.primary,
  footerMuted: p.textMuted,
  footerDot: p.border,

  // Shadow primitives kept for callers that compose their own style objects.
  shadow: isDark ? '#000000' : '#0B2A36',
  shadowOpacity: isDark ? 0.4 : 0.08,

  // Cosmetics / egg-hatching surfaces (the mini-games are gone; the egg and
  // cosmetics screens still use these).
  gameBg: p.bgAlt,
  gameCard: p.card,
  gameCardBorder: p.cardBorder,
  gameHighlight: p.primaryTint,
  xpBarBg: p.bgAlt,
  xpBarFill: p.primary,
  xpBarText: p.textInverse,

  rewardGold: '#C8891B',
  rewardSilver: '#8C9BA3',
  rewardBronze: '#A2643A',
  starActive: p.accent,
  starInactive: p.textMuted,
});

const lightPalette = expand(LIGHT, false);
const darkPalette = expand(DARK, true);

export const useThemeColors = () => {
  const { theme } = useGlobalState();
  return useMemo(() => (theme === 'dark' ? darkPalette : lightPalette), [theme]);
};

export const getThemeColors = (isDark) => (isDark ? darkPalette : lightPalette);

/** Design primitives, re-exported so a screen needs one import, not two. */
export { TYPE, SPACE, RADIUS, FONT, SHADOW, RARITY, DEMAND, TREND };
export { rarityColor, demandColor, trendColor } from '../Design/tokens';
export { darkPalette, lightPalette };
