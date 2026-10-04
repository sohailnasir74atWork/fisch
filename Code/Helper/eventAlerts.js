/**
 * Event timer alerts — the bell on each Timers card and on the Home strip.
 *
 * Turning one on subscribes this device to the FCM topic `event_<key>`
 * (blackMarket, adminAbuse, update). functions/eventTimers.js sends one topic
 * message when that event starts, so there is no per-user server state and no
 * database read for any of this.
 *
 * The choice is remembered in MMKV so the bell shows the right state on every
 * screen. Topic subscriptions belong to the FCM token, which can rotate, so the
 * remembered topics are re-subscribed at most once a week (cheap, idempotent).
 */
import { useEffect, useState } from 'react';
import { getMessaging, subscribeToTopic, unsubscribeFromTopic } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { createMMKV } from 'react-native-mmkv';
import { requestPermission } from './PermissionCheck';

const storage = createMMKV();
const K_ALERTS = 'eventAlerts';
const K_RESYNC_AT = 'eventAlertsResyncAt';
const RESYNC_EVERY_MS = 7 * 24 * 60 * 60 * 1000;

const listeners = new Set();
const read = () => {
  try { return JSON.parse(storage.getString(K_ALERTS) || '{}') || {}; } catch (_) { return {}; }
};
const write = (next) => {
  storage.set(K_ALERTS, JSON.stringify(next));
  listeners.forEach((l) => l(next));
};

export const topicFor = (key) => `event_${key}`;

export const ensureEventChannel = () =>
  notifee.createChannel({ id: 'event_timers', name: 'Event timers', importance: AndroidImportance.HIGH })
    .catch(() => null);

/**
 * Turn one event's alert on or off. Resolves to 'on' | 'off' | 'denied' |
 * 'failed' so the caller can say what happened.
 */
export async function setEventAlert(key, on) {
  try {
    if (on) {
      const granted = await requestPermission();
      if (granted === false) return 'denied';
      await ensureEventChannel();
      await subscribeToTopic(getMessaging(), topicFor(key));
      write({ ...read(), [key]: true });
      return 'on';
    }
    await unsubscribeFromTopic(getMessaging(), topicFor(key));
    const next = { ...read() };
    delete next[key];
    write(next);
    return 'off';
  } catch (_) {
    return 'failed';
  }
}

let resyncStarted = false;
const resyncIfDue = () => {
  if (resyncStarted) return;
  resyncStarted = true;
  try {
    const keys = Object.keys(read());
    if (!keys.length) return;
    const last = Number(storage.getString(K_RESYNC_AT)) || 0;
    if (Date.now() - last < RESYNC_EVERY_MS) return;
    Promise.all(keys.map((k) => subscribeToTopic(getMessaging(), topicFor(k))))
      .then(() => storage.set(K_RESYNC_AT, String(Date.now())))
      .catch(() => {});
  } catch (_) {}
};

/** { [eventKey]: true } for every event this device is subscribed to. */
export function useEventAlerts() {
  const [alerts, setAlerts] = useState(read);
  useEffect(() => {
    listeners.add(setAlerts);
    resyncIfDue();
    return () => { listeners.delete(setAlerts); };
  }, []);
  return alerts;
}
