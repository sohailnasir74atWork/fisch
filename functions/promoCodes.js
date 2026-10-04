/**
 * Promo codes — free Pro for a number of days (added 2026-10-03).
 *
 * The owner hands out codes (website, Discord, YouTubers) and a player types
 * one into Settings → "Redeem promo code". The app calls `redeemPromoCode`
 * with its Firebase ID token; nothing about a code is ever readable or
 * writable from a client, so codes cannot be listed, minted or extended.
 *
 * ── Data (RTDB, all client access denied except promoPro/$uid read) ──────
 *   promoCodes/{CODE}                { days, maxUses, uses, active, expiresAt? }
 *   promoRedemptions/{CODE}/users/{uid}      = redeemedAt ms
 *   promoRedemptions/{CODE}/devices/{sha256} = redeemedAt ms
 *   promoPro/{uid}                   { until, code, at }   ← the app reads this
 *   promoAttempts/{uid}              { windowStart, n }    ← brute-force brake
 *
 * ── Making a code (owner) ────────────────────────────────────────────────
 *   firebase database:set /promoCodes/FISCHLAUNCH \
 *     --data '{"days":7,"maxUses":1000,"uses":0,"active":true}' \
 *     --project stealanegg-5ac52
 *   Optional `expiresAt` (ms). Set `active` false to switch a code off;
 *   delete promoPro/{uid} to take Pro back from one account.
 *
 * Rules a redemption must pass, in order — each rejection names its reason so
 * the app can say something specific:
 *   signed in · ≤ 10 attempts per uid per hour · code exists and is active ·
 *   not past expiresAt · this account has not used it · this device has not
 *   used it · uses < maxUses.
 * Pro days stack onto any promo Pro the account already has.
 *
 * RevenueCat is deliberately not involved: the app configures it anonymously
 * (no Purchases.logIn), so the server has no RC customer to grant to.
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

if (!admin.apps.length) admin.initializeApp();

const DAY_MS = 24 * 60 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const MAX_DAYS = 366;

const normalizeCode = raw =>
  String(raw || '').toUpperCase().replace(/[\s-]/g, '');

const isValidCode = code => /^[A-Z0-9]{4,24}$/.test(code);

const hashDevice = deviceId =>
  crypto.createHash('sha256').update(String(deviceId)).digest('hex').slice(0, 40);

const reject = (status, reason) => {
  throw new HttpsError(status, reason, { reason });
};

/**
 * The whole redemption, separated from the callable wrapper so it can run
 * against the RTDB emulator in tests. Returns { until, days }.
 */
async function redeem({ db, uid, code: rawCode, deviceId, now = Date.now() }) {
  if (!uid) reject('unauthenticated', 'sign_in');

  // Brake first, so a guesser burns attempts even on malformed input.
  const attempt = await db.ref(`promoAttempts/${uid}`).transaction(cur => {
    if (!cur || now - (cur.windowStart || 0) > ATTEMPT_WINDOW_MS) {
      return { windowStart: now, n: 1 };
    }
    if (cur.n >= MAX_ATTEMPTS) return; // abort
    return { windowStart: cur.windowStart, n: cur.n + 1 };
  });
  if (!attempt.committed) reject('resource-exhausted', 'too_many_attempts');

  const code = normalizeCode(rawCode);
  if (!isValidCode(code)) reject('not-found', 'invalid');

  const promo = (await db.ref(`promoCodes/${code}`).get()).val();
  const days = Number(promo?.days);
  if (!promo || !(days > 0 && days <= MAX_DAYS)) reject('not-found', 'invalid');
  if (promo.active !== true) reject('failed-precondition', 'inactive');
  if (promo.expiresAt && now > Number(promo.expiresAt)) reject('failed-precondition', 'expired');

  // Claims are taken one at a time and undone if a later step refuses, so a
  // refused redemption never leaves the account or device marked as used.
  const userRef = db.ref(`promoRedemptions/${code}/users/${uid}`);
  const userClaim = await userRef.transaction(cur => (cur ? undefined : now));
  if (!userClaim.committed) reject('already-exists', 'already_redeemed');

  const undo = [userRef];
  try {
    if (deviceId) {
      const deviceRef = db.ref(`promoRedemptions/${code}/devices/${hashDevice(deviceId)}`);
      const deviceClaim = await deviceRef.transaction(cur => (cur ? undefined : now));
      if (!deviceClaim.committed) reject('already-exists', 'device_used');
      undo.push(deviceRef);
    }

    let refusal = null;
    const use = await db.ref(`promoCodes/${code}`).transaction(cur => {
      refusal = null;
      // The first pass runs against an empty local cache, so `null` here does
      // not mean "absent". Returning it lets the server retry with the real
      // value; if the node really is gone it commits a no-op, caught below.
      if (!cur) { refusal = 'invalid'; return cur; }
      if (cur.active !== true) { refusal = 'inactive'; return; }
      const uses = Number(cur.uses) || 0;
      if (cur.maxUses != null && uses >= Number(cur.maxUses)) { refusal = 'used_up'; return; }
      return { ...cur, uses: uses + 1 };
    });
    if (!use.committed || !use.snapshot.exists()) {
      reject(refusal === 'used_up' ? 'resource-exhausted' : 'failed-precondition', refusal || 'invalid');
    }
  } catch (err) {
    await Promise.all(undo.map(r => r.remove().catch(() => null)));
    throw err;
  }

  const grant = await db.ref(`promoPro/${uid}`).transaction(cur => {
    const base = Math.max(now, Number(cur?.until) || 0);
    return { until: base + days * DAY_MS, code, at: now };
  });
  return { until: grant.snapshot.val().until, days };
}

exports.redeemPromoCode = onCall({ region: 'us-central1', maxInstances: 5 }, async request => {
  const uid = request.auth?.uid;
  const { code, deviceId } = request.data || {};
  return redeem({ db: admin.database(), uid, code, deviceId });
});

exports._test = { redeem, normalizeCode, hashDevice };
