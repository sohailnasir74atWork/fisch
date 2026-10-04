/**
 * Promo codes — client half. The server half, and how codes are made, is
 * functions/promoCodes.js.
 *
 * Redeeming goes through the `redeemPromoCode` callable. The app has no
 * @react-native-firebase/functions module, and adding a native module for one
 * call is not worth a rebuild of every platform, so this speaks the callable
 * wire protocol directly: POST { data } with the user's ID token, read back
 * { result } or { error: { details: { reason } } }.
 *
 * Promo Pro lives at RTDB promoPro/{uid}.until (readable only by that uid),
 * which is how it survives a reinstall or a new phone.
 */
import { getApp } from '@react-native-firebase/app';
import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { getDatabase, ref, get } from '@react-native-firebase/database';
import DeviceInfo from 'react-native-device-info';

const REGION = 'us-central1';
const TIMEOUT_MS = 15000;

const endpoint = () =>
  `https://${REGION}-${getApp().options.projectId}.cloudfunctions.net/redeemPromoCode`;

/** Reasons the server can return; anything else is reported as 'network'. */
export const PROMO_REASONS = [
  'sign_in', 'invalid', 'inactive', 'expired', 'already_redeemed',
  'device_used', 'used_up', 'too_many_attempts',
];

export class PromoError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = PROMO_REASONS.includes(reason) ? reason : 'network';
  }
}

/** Resolves to { until, days }; rejects with a PromoError. */
export async function redeemPromoCode(code) {
  const user = getAuth().currentUser;
  if (!user) throw new PromoError('sign_in');

  let deviceId = null;
  try { deviceId = await DeviceInfo.getUniqueId(); } catch (_) {}

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const token = await getIdToken(user);
    const res = await fetch(endpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data: { code, deviceId } }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (body?.result?.until) return body.result;
    throw new PromoError(body?.error?.details?.reason);
  } catch (err) {
    throw err instanceof PromoError ? err : new PromoError('network');
  } finally {
    clearTimeout(timer);
  }
}

/** Promo Pro end time for this uid in ms, 0 when there is none, null when unreachable. */
export async function fetchPromoProUntil(uid) {
  try {
    const snap = await get(ref(getDatabase(), `promoPro/${uid}/until`));
    return Number(snap.val()) || 0;
  } catch (_) {
    return null;
  }
}
