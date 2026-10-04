import { AppState, Platform } from 'react-native';
import SpInAppUpdates, { IAUUpdateKind, IAUInstallStatus } from 'sp-react-native-in-app-updates';
import { createMMKV } from 'react-native-mmkv';

const inAppUpdates = new SpInAppUpdates(false); // set true for debug logs

// How often one store version is pushed at the user. Before this cap the check
// ran on every cold start, so between a release going live and the player
// updating, Android showed Play's blocking IMMEDIATE screen on every launch and
// iOS asked on every launch. One nudge a day per version keeps the update
// visible without hijacking every open; a genuinely forced update belongs
// behind a remote minimum-version flag, not here. (From Adopt Me.)
const NUDGE_MIN_GAP_MS = 24 * 60 * 60 * 1000;
const K_NUDGE_AT = 'updateNudgeAt';
const K_NUDGE_VERSION = 'updateNudgeVersion';

let storage = null;
try { storage = createMMKV(); } catch (_) {}

const nudgedRecently = (storeVersion) => {
  try {
    const lastVersion = storage?.getString(K_NUDGE_VERSION) || '';
    const lastAt = storage?.getNumber(K_NUDGE_AT) || 0;
    return lastVersion === storeVersion && Date.now() - lastAt < NUDGE_MIN_GAP_MS;
  } catch (_) {
    return false;
  }
};

const markNudged = (storeVersion) => {
  try {
    storage?.set(K_NUDGE_VERSION, storeVersion);
    storage?.set(K_NUDGE_AT, Date.now());
  } catch (_) {}
};

// Android FLEXIBLE updates download while the player keeps using the app. The
// install restarts the app, so it is applied only once the app is in the
// background, where Play performs it silently.
let installListenerArmed = false;
const armFlexibleInstall = () => {
  if (installListenerArmed) return;
  installListenerArmed = true;
  let downloaded = false;
  const installWhenHidden = () => {
    if (!downloaded || AppState.currentState !== 'background') return;
    downloaded = false;
    try { inAppUpdates.installUpdate(); } catch (_) {}
  };
  inAppUpdates.addStatusUpdateListener((event) => {
    if (event?.status === IAUInstallStatus.DOWNLOADED) {
      downloaded = true;
      installWhenHidden();
    }
  });
  AppState.addEventListener('change', installWhenHidden);
};

export const checkForUpdate = async () => {
  if (__DEV__) return;

  try {
    const result = await inAppUpdates.checkNeedsUpdate();
    if (!result?.shouldUpdate) return;

    const storeVersion = String(result.storeVersion || 'unknown');
    if (nudgedRecently(storeVersion)) return;
    markNudged(storeVersion);

    if (Platform.OS === 'android') {
      armFlexibleInstall();
      await inAppUpdates.startUpdate({ updateType: IAUUpdateKind.FLEXIBLE });
    } else {
      await inAppUpdates.startUpdate({
        title: 'Update Available',
        message:
          'A new version of the app is available. Please update for the best experience.',
        buttonUpgradeText: 'Update',
        buttonCancelText: 'Later',
        forceUpgrade: false,
      });
    }
  } catch (err) {
    console.warn('In-app update check failed:', err?.message || err);
  }
};
