/**
 * ui.js — the shared primitives every screen builds from.
 *
 * tokens.js says what the values are; this says what the *shapes* are. The two
 * together are what actually produces a symmetric app, because symmetry comes
 * from repeated structure, not from matching colours.
 *
 * The audit found the same handful of shapes redeclared across 57 local
 * StyleSheets — `container` 24 times, `header` 18, `input` 13, `emptyText` 13,
 * `card` 8, `modalOverlay` 6 — each slightly different. A 12pt pad here, 14
 * there; radius 10 on one card, 12 on the next. Individually invisible,
 * collectively the reason the app reads as unsettled.
 *
 * Usage:
 *   const s = useUI();
 *   <View style={s.screen}><View style={s.card}>…</View></View>
 *
 * These are style objects, not components, so they compose with whatever a
 * screen already does: style={[s.card, { marginTop: SPACE.lg }]}.
 */

import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useThemeColors } from '../Helper/themeColors';
import { TYPE, SPACE, RADIUS, SHADOW } from './tokens';

export const makeUI = (c) =>
  StyleSheet.create({
    // ── Layout ──────────────────────────────────────────────────────────
    screen: { flex: 1, backgroundColor: c.bg },
    // Screens with their own scroll view want padding on the content, not the
    // container, or the scrollbar insets and looks detached from the edge.
    screenPad: { paddingHorizontal: SPACE.lg },
    content: { padding: SPACE.lg, paddingBottom: SPACE.xxxl },
    row: { flexDirection: 'row', alignItems: 'center' },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    gap: { gap: SPACE.sm },

    // ── Surfaces ────────────────────────────────────────────────────────
    card: {
      backgroundColor: c.card,
      borderRadius: RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      padding: SPACE.lg,
      ...SHADOW.sm,
    },
    // Flush card for list rows: no shadow, because stacked shadows read as
    // noise rather than depth.
    cardFlat: {
      backgroundColor: c.card,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.cardBorder,
      padding: SPACE.md,
    },
    // Full-bleed tinted band that marks a section as its own region.
    band: {
      backgroundColor: c.bgAlt,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingVertical: SPACE.lg,
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.divider },

    // ── Type ────────────────────────────────────────────────────────────
    display: { ...TYPE.display, color: c.text },
    title: { ...TYPE.title, color: c.text },
    heading: { ...TYPE.heading, color: c.text },
    subtitle: { ...TYPE.subtitle, color: c.text },
    body: { ...TYPE.body, color: c.text },
    callout: { ...TYPE.callout, color: c.text },
    caption: { ...TYPE.caption, color: c.textSecondary },
    label: { ...TYPE.label, color: c.textMuted, textTransform: 'uppercase' },
    muted: { ...TYPE.caption, color: c.textMuted },

    // ── Headers ─────────────────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACE.lg,
      paddingVertical: SPACE.md,
      backgroundColor: c.bgElevated,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    headerTitle: { ...TYPE.heading, color: c.text },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACE.lg,
      marginBottom: SPACE.md,
    },
    sectionTitle: { ...TYPE.subtitle, color: c.text },

    // ── Controls ────────────────────────────────────────────────────────
    button: {
      backgroundColor: c.primary,
      borderRadius: RADIUS.md,
      paddingVertical: SPACE.md,
      paddingHorizontal: SPACE.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: SPACE.sm,
    },
    buttonText: { ...TYPE.callout, color: c.onPrimary },
    buttonSecondary: {
      backgroundColor: c.primaryTint,
      borderRadius: RADIUS.md,
      paddingVertical: SPACE.md,
      paddingHorizontal: SPACE.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: SPACE.sm,
    },
    buttonSecondaryText: { ...TYPE.callout, color: c.primary },
    buttonGhost: {
      borderRadius: RADIUS.md,
      paddingVertical: SPACE.sm,
      paddingHorizontal: SPACE.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.bgElevated,
    },
    buttonDisabled: { opacity: 0.45 },

    input: {
      backgroundColor: c.inputBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.inputBorder,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACE.md,
      // Vertical padding rather than a fixed height: a fixed height clips
      // descenders once the OS font scale is turned up.
      paddingVertical: SPACE.md,
      ...TYPE.body,
      color: c.text,
    },

    // ── Badges ──────────────────────────────────────────────────────────
    badge: {
      paddingHorizontal: SPACE.sm,
      paddingVertical: 3,
      borderRadius: RADIUS.pill,
      backgroundColor: c.bgAlt,
      alignSelf: 'flex-start',
    },
    badgeText: { ...TYPE.label, color: c.textSecondary },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACE.xs,
      paddingHorizontal: SPACE.md,
      paddingVertical: SPACE.sm,
      borderRadius: RADIUS.pill,
      backgroundColor: c.bgAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    chipActive: { backgroundColor: c.primaryTint, borderColor: c.primary },
    chipText: { ...TYPE.caption, color: c.textSecondary },
    chipTextActive: { ...TYPE.caption, color: c.primary },

    // ── Modals ──────────────────────────────────────────────────────────
    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: c.bgElevated,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      paddingTop: SPACE.md,
      paddingHorizontal: SPACE.lg,
      paddingBottom: SPACE.xl,
      maxHeight: '88%',
    },
    modalGrabber: {
      width: 36, height: 4, borderRadius: RADIUS.pill,
      backgroundColor: c.border, alignSelf: 'center', marginBottom: SPACE.md,
    },
    modalTitle: { ...TYPE.heading, color: c.text, marginBottom: SPACE.md },

    // ── Empty / loading ─────────────────────────────────────────────────
    emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl, gap: SPACE.sm },
    emptyText: { ...TYPE.body, color: c.textMuted, textAlign: 'center' },
  });

export const useUI = () => {
  const c = useThemeColors();
  return useMemo(() => ({ ...makeUI(c), c }), [c]);
};

export default useUI;
