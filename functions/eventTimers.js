/**
 * Event timer pushes (2026-10-04).
 *
 * Players tap the bell on a Timers card (Black Market, Admin Abuse, Weekly
 * update) and the app subscribes the device to the FCM topic `event_<key>`.
 * This job sends ONE topic message when an event starts. Topics are the
 * cheapest delivery there is: one send however many players subscribed, no
 * per-user database reads, no token bookkeeping.
 *
 * The schedule is the same `meta.schedule` the app counts down from (the CDN
 * feed). The feed is 4.5 MB (420 KB gzipped), so it is NOT fetched every run:
 * the schedule alone is cached at RTDB eventTimers/_schedule and refreshed
 * every 6 hours (~50 MB a month instead of ~1.8 GB). eventTimers/sent/<key>
 * holds the start of the last occurrence announced, written in a transaction,
 * so an occurrence is announced once even if two runs overlap. Both nodes are
 * server-only in database.rules.json.
 *
 * Deploy:  firebase deploy --only functions:notifyEventTimers --project stealanegg-5ac52
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions/v1');

if (!admin.apps.length) admin.initializeApp();

const FEED_URL = 'https://fischvalues.b-cdn.net/data.json?schema=2';
const SCHEDULE_TTL_MS = 6 * 60 * 60 * 1000;
// A run every 10 minutes; anything that started within this window and has
// not been announced yet gets its push. Wider than the interval so a late or
// skipped run still catches the start.
const ANNOUNCE_WINDOW_MS = 30 * 60 * 1000;
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// Same arithmetic as the app's Code/Helper/useNextEvent.js nextOccurrence, so
// the push and the countdown agree. Returns the most recent start <= now.
const latestStart = (now, weekday, hourUTC) => {
  if (!Number.isFinite(weekday)) return null;
  const hour = Number.isFinite(hourUTC) ? hourUTC : 0;
  const d = new Date(now);
  let slot = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, 0, 0, 0)
    + (weekday - d.getUTCDay()) * DAY;
  while (slot > now) slot -= 7 * DAY;
  return slot;
};

const EVENTS = [
  {
    key: 'blackMarket',
    message: (cfg, approx) => ({
      title: '🛒 Black Market is open',
      body: approx
        ? `The Black Market opens today${cfg.locations?.length ? ` at ${cfg.locations.join(' & ')}` : ''}. Exact hour unconfirmed.`
        : `Head to ${cfg.locations?.join(' or ') || 'the Shady Bazaar'} before it closes.`,
    }),
  },
  {
    key: 'adminAbuse',
    message: () => ({
      title: '⚡ Admin Abuse is starting',
      body: 'Admin Abuse is live in Fisch now. Jump in!',
    }),
  },
  {
    key: 'update',
    message: () => ({
      title: '🎣 Fisch update is out',
      body: 'The weekly Fisch update just dropped. Check new values in the app.',
    }),
  },
];

const readSchedule = async (db, now) => {
  const cachedSnap = await db.ref('eventTimers/_schedule').get();
  const cached = cachedSnap.val();
  if (cached?.schedule && now - (cached.fetchedAt || 0) < SCHEDULE_TTL_MS) return cached.schedule;
  try {
    const res = await fetch(FEED_URL, { headers: { 'Accept-Encoding': 'gzip' } });
    if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
    const feed = await res.json();
    const meta = Array.isArray(feed) ? feed[0] : feed?.meta;
    const schedule = meta?.schedule;
    if (!schedule) throw new Error('feed has no meta.schedule');
    await db.ref('eventTimers/_schedule').set({ schedule, fetchedAt: now });
    return schedule;
  } catch (err) {
    console.warn('eventTimers: schedule refresh failed, using cache:', err.message);
    return cached?.schedule || null;
  }
};

const runOnce = async ({ db, messaging, now = Date.now() }) => {
  const schedule = await readSchedule(db, now);
  if (!schedule) return { sent: [] };
  const sent = [];
  for (const ev of EVENTS) {
    const cfg = schedule[ev.key];
    if (!cfg) continue;
    const start = latestStart(now, Number(cfg.weekday), Number.isFinite(cfg.hourUTC) ? cfg.hourUTC : undefined);
    if (start == null || now - start >= ANNOUNCE_WINDOW_MS) continue;

    const claim = await db.ref(`eventTimers/sent/${ev.key}`)
      .transaction((cur) => (cur === start ? undefined : start));
    if (!claim.committed) continue; // already announced

    const { title, body } = ev.message(cfg, !Number.isFinite(cfg.hourUTC));
    await messaging.send({
      topic: `event_${ev.key}`,
      notification: { title, body },
      data: { kind: 'event_timer', event: ev.key },
      android: {
        priority: 'high',
        notification: { channelId: 'event_timers', icon: 'ic_stat_clown_fish', color: '#E63A2E' },
      },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    sent.push(ev.key);
  }
  return { sent };
};

exports.notifyEventTimers = functions
  .runWith({ memory: '256MB', timeoutSeconds: 120 })
  .pubsub.schedule('every 10 minutes')
  .timeZone('UTC')
  .onRun(async () => {
    const result = await runOnce({ db: admin.database(), messaging: admin.messaging() });
    if (result.sent.length) console.log('⏰ event pushes sent:', result.sent.join(', '));
    return null;
  });

exports._test = { latestStart, runOnce };
