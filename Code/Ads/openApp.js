import { AppState } from 'react-native';
import { AppOpenAd, AdEventType } from 'react-native-google-mobile-ads';
import getAdUnitId from './ads';
import { ensureAdsInitialized } from './init';
import {
  setFullScreenAdVisible,
  isFullScreenAdVisible,
  markFullScreenAdShown,
  msSinceOtherFullScreenAd,
} from './adVisibility';
import { APP_OPEN_MIN_BACKGROUND_MS, CROSS_FORMAT_GAP_MS, POST_SHOW_RELOAD_MS, isNoFillError } from './adPolicy';
import { adsEnabled } from './adsEnabled';

const adUnitId = getAdUnitId('openapp');

// App Open ads expire ~4h after load — showing an expired ad is a silent
// no-op / wasted slot, so we reload instead.
const AD_EXPIRY_MS = 4 * 60 * 60 * 1000;
// Don't show more than once per this window, so quick app-switches (e.g.
// flicking to another app for 5s and back) don't spam the user.
const MIN_INTERVAL_MS = 2 * 60 * 1000;

// isPro is read straight from MMKV so every foreground show respects the
// latest purchase state without any React wiring into this singleton.
let storage = null;
try {
  const { createMMKV } = require('react-native-mmkv');
  storage = createMMKV();
} catch (_) {}
// Cold-start ad rules (AdMob accidental-click policy; from Adopt Me's
// openApp.js). The ad used to show whenever it finished loading — on a
// player's very first launch, and seconds into a session over a Home screen
// they were already tapping. Now: never on the first launch, and only if it is
// ready within COLD_START_BUDGET_MS of app start (about when the splash
// hides); otherwise this launch has no cold-start ad and the next genuine
// foreground return can show one. Frequency/caps are unchanged.
const APP_START_AT = Date.now();
const COLD_START_BUDGET_MS = 4000;
const K_LAUNCHED_BEFORE = 'appOpenLaunchedBefore';
// At most one cold-start ad per this gap, like Adopt Me / Blox. Without it a
// player reopening the app several times a day got a launch ad every time
// (reviewed 2026-10-04; MM2 dropped launch ads over exactly that complaint).
const COLD_START_MIN_GAP_MS = 4 * 60 * 60 * 1000;
const K_LAST_COLD_AD = 'appOpenLastColdStartAt';
let launchedBefore = false;
try {
  // isAppReady is written to storage on every earlier launch, so installs
  // from before this key existed still count as returning players.
  launchedBefore = !!storage && (storage.getBoolean(K_LAUNCHED_BEFORE) === true ||
    storage.getBoolean('isAppReady') === true);
  storage?.set(K_LAUNCHED_BEFORE, true);
} catch (_) {}

const isProUser = () => {
  try {
    return storage ? storage.getBoolean('isPro') === true : false;
  } catch (_) {
    return false;
  }
};

/**
 * App Open ad manager.
 *
 * Previous version showed exactly ONE ad per app lifetime (`hasShownOnce`) and
 * never reloaded — so the highest-eCPM format fired once and went dark for the
 * rest of the session. This version keeps an ad warm and shows it on every
 * genuine background→foreground return (capped + Pro-gated + de-duped against
 * other full-screen ads), which is where App Open revenue actually lives for a
 * utility app users reopen many times a day.
 */
class AppOpenAdManager {
  static ad = null;
  static isLoaded = false;
  static isLoading = false;
  static loadedAt = 0;
  static lastShownAt = 0;
  static isShowing = false;
  static hasStarted = false;
  static showOnFirstLoad = false;
  static coldStartPending = false;
  static wasBackgrounded = false;
  static backgroundedAt = 0;
  static retryCount = 0;
  static maxRetries = 3;
  static unsubscribeEvents = [];
  static appStateSub = null;
  static showWatchdog = null;
  static skipForegroundUntil = 0;
  static foregroundTimer = null;

  /**
   * Our own trips out of the app (the Play purchase sheet, the Android share
   * chooser) come back through 'active' exactly like a real return, and got an
   * app-open ad: shown to someone who had just tried to BUY ad-free, before the
   * purchase had even confirmed (so isProUser() was still false). Call right
   * before leaving; the window only bounds how long an unused skip lingers
   * (iOS's StoreKit and share sheets never background the app, so it is never
   * consumed there). (From adoptme-jan7 / mm2values.)
   */
  static skipNextForeground(ms = 5 * 60 * 1000) {
    this.skipForegroundUntil = Date.now() + ms;
  }

  // Call once after onboarding, for non-Pro users.
  static start() {
    // Debug builds: never arm the App Open ad. It otherwise covers the app on
    // every cold start and foreground return. See Code/Ads/adsEnabled.js.
    if (!adsEnabled()) return;
    if (this.hasStarted) return;
    this.hasStarted = true;

    // One ad on cold start via the same guarded path (Pro / cap / expiry all
    // respected) — but not on the first-ever launch. See the rules above.
    let lastCold = 0;
    try { lastCold = Number(storage?.getString(K_LAST_COLD_AD)) || 0; } catch (_) {}
    this.showOnFirstLoad = launchedBefore && Date.now() - lastCold >= COLD_START_MIN_GAP_MS;

    ensureAdsInitialized()
      .then(() => this._createAndLoad())
      .catch(() => {});

    this.appStateSub = AppState.addEventListener('change', (next) => {
      // Track real backgrounding. iOS bounces active→inactive→active for
      // system prompts (ATT, consent, permission dialogs) WITHOUT ever hitting
      // 'background', so those never set the flag and never trigger a stray ad.
      if (next === 'background') {
        // On Android a full-screen ad is its own Activity: showing one pauses
        // ours, so RN reports 'background', and closing it reports 'active'.
        // That read as a return to the app and fired this ad straight after
        // every interstitial/rewarded ("i watched ad and after watching i get
        // another ad"). Our own ad being on screen is how we tell them apart.
        if (!isFullScreenAdVisible()) {
          this.wasBackgrounded = true;
          this.backgroundedAt = Date.now();
        }
      } else if (next === 'active') {
        if (this.wasBackgrounded) {
          this.wasBackgrounded = false;
          if (Date.now() < this.skipForegroundUntil) {
            this.skipForegroundUntil = 0;
            return;
          }
          // A quick flick to Roblox and back is not a new session — the user
          // never left. Only a genuine absence earns an app-open ad.
          if (Date.now() - this.backgroundedAt < APP_OPEN_MIN_BACKGROUND_MS) return;
          this._showOnForeground();
        }
      }
    });
  }

  static _createAndLoad() {
    this._cleanupAd();
    this.ad = AppOpenAd.createForAdRequest(adUnitId);

    const onLoaded = this.ad.addAdEventListener(AdEventType.LOADED, () => {
      this.isLoaded = true;
      this.isLoading = false;
      this.loadedAt = Date.now();
      this.retryCount = 0;
      if (this.showOnFirstLoad) {
        this.showOnFirstLoad = false;
        // Too late: the player is already using the app.
        if (Date.now() <= APP_START_AT + COLD_START_BUDGET_MS) {
          this.coldStartPending = true;
          this.showAdIfAvailable();
          if (!this.isShowing) this.coldStartPending = false;
        }
      }
    });

    const onError = this.ad.addAdEventListener(AdEventType.ERROR, (error) => {
      this.isLoaded = false;
      this.isLoading = false;
      this._retryLoad(isNoFillError(error));
    });

    // OPENED confirms the ad actually presented — cancel the show watchdog so
    // a legitimately-open ad isn't force-reset out from under the user.
    const onOpened = this.ad.addAdEventListener(AdEventType.OPENED, () => {
      markFullScreenAdShown('app_open');
      if (this.coldStartPending) {
        this.coldStartPending = false;
        try { storage?.set(K_LAST_COLD_AD, String(Date.now())); } catch (_) {}
      }
      this._clearShowWatchdog();
    });

    const onClosed = this.ad.addAdEventListener(AdEventType.CLOSED, () => {
      this._clearShowWatchdog();
      setFullScreenAdVisible(false);
      this.isShowing = false;
      this.isLoaded = false;
      // Warm up the next one for the next foreground return — after the
      // AdMob cap window, or the request fails with "frequency cap reached"
      // and nothing is ready for that return (see POST_SHOW_RELOAD_MS).
      setTimeout(() => this._load(), POST_SHOW_RELOAD_MS);
    });

    this.unsubscribeEvents = [onLoaded, onError, onOpened, onClosed];
    this._load();
  }

  static _load() {
    if (this.isLoaded || this.isLoading || !this.ad) return;
    this.isLoading = true;
    try {
      this.ad.load();
    } catch (_) {
      this.isLoading = false;
      this._retryLoad();
    }
  }

  // Exponential backoff (1s,2s,4s), then STOP. The old 30s-forever loop
  // burned no-fill requests all session in zero-fill geos. Every
  // background→foreground return calls showAdIfAvailable(), which calls
  // _load() when nothing is loaded — that natural signal replaces the
  // blind timer. A "no fill" answer gets no retry at all: the auction had
  // nothing for this user, and the 1→16s backoff used to answer that with
  // five more identical requests per launch (AdMob: 2.8M requests for 812K
  // app-open impressions in one app).
  static _retryLoad(noFill) {
    if (noFill) return;
    if (this.retryCount >= this.maxRetries) return;
    const delay = Math.pow(2, this.retryCount) * 1000;
    setTimeout(() => {
      this.retryCount += 1;
      this._load();
    }, delay);
  }

  static _isExpired() {
    return Date.now() - this.loadedAt > AD_EXPIRY_MS;
  }

  static _clearShowWatchdog() {
    if (this.showWatchdog) {
      clearTimeout(this.showWatchdog);
      this.showWatchdog = null;
    }
  }

  // Returning to the foreground is the one moment the app is guaranteed to be
  // mid-reflow: screens re-render and their AppState effects fire, which is
  // exactly when a drawer can be re-presenting. Presenting an ad into that is
  // what UIKit refuses, and the user is left looking at a frozen screen. One
  // short beat lets the view-controller stack settle first. (From adoptme-jan7.)
  static _showOnForeground() {
    if (this.foregroundTimer) clearTimeout(this.foregroundTimer);
    this.foregroundTimer = setTimeout(() => {
      this.foregroundTimer = null;
      // The user may have backgrounded again inside the delay — never present
      // into an app that is no longer on screen.
      if (AppState.currentState !== 'active') return;
      this.showAdIfAvailable();
    }, 350);
  }

  // Shared reset for a present that never reached the screen (show() threw,
  // its promise rejected, or the watchdog fired with no OPENED/CLOSED).
  static _resetFailedShow() {
    this._clearShowWatchdog();
    setFullScreenAdVisible(false);
    this.isShowing = false;
    // Nothing was displayed, so don't burn the 2-minute cap on an impression
    // the user never saw.
    this.lastShownAt = 0;
    this._createAndLoad();
  }

  static showAdIfAvailable() {
    if (isProUser()) return;
    // Never stack on top of an interstitial/rewarded, or on ourselves, and
    // never follow one of them within the cross-format gap.
    if (this.isShowing || isFullScreenAdVisible()) return;
    if (msSinceOtherFullScreenAd('app_open') < CROSS_FORMAT_GAP_MS) return;
    // Frequency cap.
    if (Date.now() - this.lastShownAt < MIN_INTERVAL_MS) return;

    if (!this.isLoaded || !this.ad) {
      this._load();
      return;
    }
    if (this._isExpired()) {
      this.isLoaded = false;
      this._createAndLoad();
      return;
    }

    this.isShowing = true;
    this.lastShownAt = Date.now();
    setFullScreenAdVisible(true);
    // Watchdog: App Open ads are frequently dismissed by re-backgrounding the
    // app rather than a clean close, and in those cases CLOSED can fail to
    // fire — which would leave isShowing + the shared full-screen flag stuck
    // true forever and silently block every future App Open ad. If neither
    // OPENED nor CLOSED has resolved this within 10s, force a clean reset so
    // the next foreground return can show again.
    this._clearShowWatchdog();
    this.showWatchdog = setTimeout(() => {
      this.showWatchdog = null;
      if (this.isShowing) this._resetFailedShow();
    }, 10000);
    try {
      // show() returns a promise; a refused present rejects it rather than
      // throwing, and an unhandled rejection would skip the reset entirely.
      // Only reset if this attempt is still the live one (CLOSED may already
      // have cleaned up).
      const shown = this.ad.show();
      if (shown && typeof shown.catch === 'function') {
        shown.catch(() => {
          if (this.isShowing) this._resetFailedShow();
        });
      }
      this.isLoaded = false;
    } catch (_) {
      this._resetFailedShow();
    }
  }

  static _cleanupAd() {
    this.unsubscribeEvents.forEach((u) => {
      try {
        u();
      } catch (_) {}
    });
    this.unsubscribeEvents = [];
    this.isLoaded = false;
    this.isLoading = false;
  }

  static stop() {
    this._clearShowWatchdog();
    if (this.foregroundTimer) {
      clearTimeout(this.foregroundTimer);
      this.foregroundTimer = null;
    }
    if (this.appStateSub) {
      this.appStateSub.remove();
      this.appStateSub = null;
    }
    this._cleanupAd();
    this.hasStarted = false;
    this.ad = null;
  }
}

export default AppOpenAdManager;
