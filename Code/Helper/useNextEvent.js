/**
 * useNextEvent — the one event worth putting on the Home screen right now.
 *
 * Extracted from TimerScreen so Home and Timers can never disagree about when
 * the Black Market opens. The screen owns presentation; this owns the clock.
 *
 * Returns the LIVE event if one is running, otherwise the soonest upcoming one,
 * or null when the feed has no schedule yet.
 */
import { useMemo, useState, useEffect } from 'react';
import { useLocalState } from '../LocalGlobelStats';
import { feedMeta } from './valueSources';
import { serverNowMs } from './serverTime';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/**
 * Next UTC occurrence of a weekly slot, and whether it is running right now.
 *
 * `weekday` follows JS `getUTCDay()` (0 = Sunday, 6 = Saturday). Computed in UTC
 * and only formatted locally — the other way round breaks for anyone whose local
 * weekday differs from UTC's at the moment of the event.
 *
 * Two traps, both hit for real:
 *  - Black Market has NO `hourUTC` (only a weekday and a 48h duration), so
 *    requiring one drops the game's most-searched event entirely.
 *  - It runs across days, so on a Sunday `getUTCDay()` is 0 and the arithmetic
 *    lands on NEXT Saturday, stepping clean over an event in progress. Rewind
 *    to the most recent occurrence BEFORE walking forward.
 */
export const nextOccurrence = (now, weekday, hourUTC, durationMs) => {
  if (!Number.isFinite(weekday)) return null;
  const hour = Number.isFinite(hourUTC) ? hourUTC : 0;

  const d = new Date(now);
  const base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, 0, 0, 0);
  let slot = base + ((weekday - d.getUTCDay()) * DAY);
  const ends = () => slot + (durationMs || 0);

  while (slot > now) slot -= 7 * DAY;
  while (ends() <= now) slot += 7 * DAY;

  return { start: slot, end: ends(), live: now >= slot && now < ends() };
};

/** "2d 4h 13m" — the largest two units, which is what a countdown needs. */
export const countdown = (ms) => {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
};

/** Every scheduled event, live first then soonest. */
export const useScheduledEvents = (tickMs = 1000) => {
  const { localState } = useLocalState();
  const [now, setNow] = useState(() => serverNowMs());

  useEffect(() => {
    const id = setInterval(() => setNow(serverNowMs()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  const schedule = useMemo(() => {
    try {
      const raw = localState.feedMeta;
      if (!raw) return null;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return parsed?.schedule || feedMeta(parsed)?.schedule || null;
    } catch { return null; }
  }, [localState.feedMeta]);

  const events = useMemo(() => {
    if (!schedule) return [];
    const build = (key, cfg, icon, durationMs, extra) => {
      if (!cfg) return null;
      const occ = nextOccurrence(now, cfg.weekday, cfg.hourUTC, durationMs);
      if (!occ) return null;
      return {
        key, icon, extra,
        label: cfg.label || key,
        confidence: cfg.confidence,
        evidence: cfg.evidence,
        approxStart: !Number.isFinite(cfg.hourUTC),
        weekdayName: cfg.weekdayName,
        ...occ,
      };
    };

    return [
      build('blackMarket', schedule.blackMarket, 'cart',
        (Number(schedule.blackMarket?.durationHours) || 48) * HOUR,
        schedule.blackMarket?.locations?.join('  ·  ')),
      build('adminAbuse', schedule.adminAbuse, 'flash',
        (Number(schedule.adminAbuse?.typicalDurationMinutes) || 60) * 60 * 1000, null),
      build('update', schedule.update, 'download', 0, null),
    ].filter(Boolean).sort((a, b) => (b.live - a.live) || (a.start - b.start));
  }, [schedule, now]);

  return { events, now, schedule };
};

/** Just the headline one, for the Home strip. */
export const useNextEvent = (tickMs = 1000) => {
  const { events, now } = useScheduledEvents(tickMs);
  return { event: events[0] || null, now };
};

export default useNextEvent;
