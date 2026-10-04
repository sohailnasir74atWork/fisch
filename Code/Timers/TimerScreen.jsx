/**
 * TimerScreen — when the next Black Market, Admin Abuse and weekly update land.
 *
 * `black market fisch roblox location` is a BREAKOUT query and the wiki answers
 * it with prose ("lasts 2 days, globalized"), not a clock. This screen answers
 * it with a countdown.
 *
 * Everything here is driven by `meta.schedule` in the feed, which the pipeline
 * measures from 122 dated releases rather than hardcoding. That matters twice
 * over: a shifted schedule ships with the next data build instead of an app
 * release, AND each entry carries its own `confidence`, which this screen
 * surfaces verbatim. "Measured" and "community-reported" are different claims
 * and a timer that presents a rumour as fact is worse than no timer.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useUI } from '../Design/ui';
import { SPACE, SIZE, TYPE, RADIUS, SHADOW, STATUS } from '../Design/tokens';
// The clock lives in the hook so this screen and the Home strip can never
// disagree about when the Black Market opens.
import { useScheduledEvents, countdown } from '../Helper/useNextEvent';
import EventBell from './EventBell';

const localTime = (ms) =>
  new Date(ms).toLocaleString(undefined, {
    weekday: 'short', hour: 'numeric', minute: '2-digit',
  });

const TimerScreen = () => {
  const ui = useUI();
  const c = ui.c;
  const { events, now, schedule } = useScheduledEvents();

  const s = useMemo(() => makeStyles(c), [c]);

  if (!schedule) {
    return (
      <View style={[ui.screen, ui.emptyContainer]}>
        <Icon name="time-outline" size={SIZE.display} color={c.textMuted} />
        <Text style={ui.emptyText}>
          Schedule data still loading. Pull the Values screen to refresh the feed.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={s.content}>
      {events.map((e) => (
        <View key={e.key} style={[s.card, e.live && s.cardLive]}>
          <View style={s.head}>
            <View style={s.headLeft}>
              <Icon name={e.icon} size={SIZE.subtitle} color={e.live ? STATUS.success : c.primary} />
              <Text style={s.title}>{e.label}</Text>
            </View>
            <View style={s.headRight}>
              {e.live ? (
                <View style={s.liveTag}>
                  <View style={s.liveDot} />
                  <Text style={s.liveText}>LIVE</Text>
                </View>
              ) : (
                <Text style={s.confidence}>
                  {e.confidence === 'measured' ? 'Measured' : 'Community'}
                </Text>
              )}
              {/* Push when this event starts (functions/eventTimers.js). */}
              <EventBell eventKey={e.key} label={e.label} color={e.live ? STATUS.success : c.primary} />
            </View>
          </View>

          <Text style={[s.clock, e.live && s.clockLive]}>
            {e.live ? countdown(e.end - now) : countdown(e.start - now)}
          </Text>
          <Text style={s.clockLabel}>
            {e.live
              ? 'remaining'
              : e.approxStart
                ? `until ${e.weekdayName || 'it starts'} — exact hour unconfirmed`
                : `until it starts · ${localTime(e.start)} your time`}
          </Text>

          {!!e.extra && (
            <View style={s.locations}>
              <Icon name="location-outline" size={SIZE.caption} color={c.textMuted} />
              <Text style={s.locationText}>{e.extra}</Text>
            </View>
          )}

          {/* The evidence line is the whole point of surfacing confidence: it
              says exactly how well this time is known, in the pipeline's own
              words, so a wrong rumour is visibly a rumour. */}
          {!!e.evidence && <Text style={s.evidence}>{e.evidence}</Text>}
        </View>
      ))}

      <Text style={s.footer}>
        All times derived from {schedule.measuredFrom?.releases ?? 0} dated releases
        {schedule.measuredFrom?.timed ? `, ${schedule.measuredFrom.timed} with a known hour` : ''}.
        Schedule is {schedule.timezone || 'UTC'}-based; countdowns are shown in your local time.
      </Text>
    </ScrollView>
  );
};

const makeStyles = (c) =>
  StyleSheet.create({
    content: { padding: SPACE.lg, paddingBottom: SPACE.giant, gap: SPACE.xl },

    card: {
      backgroundColor: c.card, borderRadius: RADIUS.lg, padding: SPACE.xxl,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.cardBorder,
      ...SHADOW.sm,
    },
    cardLive: { borderColor: STATUS.success, backgroundColor: c.successTint },

    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
    headRight: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
    title: { ...TYPE.subtitle, color: c.text },
    confidence: {
      ...TYPE.label, color: c.textMuted,
      paddingHorizontal: SPACE.md, paddingVertical: SPACE.hair,
      backgroundColor: c.bgAlt, borderRadius: RADIUS.pill, overflow: 'hidden',
    },
    liveTag: {
      flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
      paddingHorizontal: SPACE.md, paddingVertical: SPACE.hair,
      backgroundColor: STATUS.success, borderRadius: RADIUS.pill,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
    liveText: { ...TYPE.label, color: '#FFFFFF' },

    clock: { ...TYPE.display, color: c.text, marginTop: SPACE.lg },
    clockLive: { color: STATUS.success },
    clockLabel: { ...TYPE.caption, color: c.textMuted },

    locations: {
      flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
      marginTop: SPACE.lg,
    },
    locationText: { ...TYPE.caption, color: c.textSecondary, flex: 1 },

    evidence: {
      ...TYPE.small, color: c.textMuted, marginTop: SPACE.md,
      paddingTop: SPACE.md,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider,
    },

    footer: { ...TYPE.caption, color: c.textMuted, textAlign: 'center', paddingHorizontal: SPACE.lg },
  });

export default TimerScreen;
