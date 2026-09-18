import { Alert, Linking, Platform } from "react-native";
import config from "../Helper/Environment";
import Share from 'react-native-share';
import DeviceInfo from 'react-native-device-info';
import Purchases from 'react-native-purchases';
import { GAME } from '../config/game';

export const getAppDownloadLink = () => {
    return Platform.OS === 'ios'
      ? config.IOsShareLink
      : config.andriodShareLink;
  };

  export const handleShareApp = async () => {
    try {
      const appLink = getAppDownloadLink();
      const shareOptions = {
        message: `Explore the Adoptme value calculator, check values, and make smarter trades. Download now: ${appLink}`,
        title: 'Share App',
      };
      await Share.open(shareOptions);
    } catch (error) {
      // console.error('Share error:', error);
    }
  };
  

  

export const handleGetSuggestions = async (user) => {
  try {
    // ✅ Get App Details
    const appName = DeviceInfo.getApplicationName();
    const appVersion = DeviceInfo.getVersion();
    const platform = Platform.OS; // "ios" or "android"

    // ✅ Get User & RevenueCat ID
    const userId = user?.id || 'Guest'; // Default to Guest if not logged in
    const revenueCatInfo = await Purchases.getCustomerInfo();
    const revenueCatUserId = revenueCatInfo?.originalAppUserId || 'Anonymous';

    // ✅ Construct Email Body
    const email = config.supportEmail;
    const subject = `App Feedback and Suggestions (${appName})`;
    const body = `Hi team,

I would like to share the following suggestions:

---

📌 App Name: ${appName}  
📌 App Version: ${appVersion}  
📌 User ID: ${userId}  
📌 RC ID: ${revenueCatUserId}  
📌 Platform: ${platform}  

---`;

    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // ✅ Open email client
    Linking.openURL(mailtoUrl).catch(() =>
      Alert.alert('Error', 'Unable to open the email client. Please try again later.')
    );
  } catch (error) {
    console.error('❌ Error opening feedback email:', error);
    Alert.alert('Error', 'Could not prepare the email. Please try again.');
  }
};
export const handleReport = async (user) => {
  try {
    // ✅ Get App Details
    const appName = DeviceInfo.getApplicationName();
    const appVersion = DeviceInfo.getVersion();
    const platform = Platform.OS; // "ios" or "android"

    // ✅ Get User & RevenueCat ID
    const userId = user?.id || 'Guest'; // Default to Guest if not logged in
    const revenueCatInfo = await Purchases.getCustomerInfo();
    const revenueCatUserId = revenueCatInfo?.originalAppUserId || 'Anonymous';

    // ✅ Construct Email Body
    const email = 'how2techxyz@gmail.com';
    const subject = `Report About Abusive Content (${appName})`;
    const body = `Hi team,

I would like to report ...

---

📌 App Name: ${appName}  
📌 App Version: ${appVersion}  
📌 User ID: ${userId}  
📌 RC ID: ${revenueCatUserId}  
📌 Platform: ${platform}  

---`;

    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // ✅ Open email client
    Linking.openURL(mailtoUrl).catch(() =>
      Alert.alert('Error', 'Unable to open the email client. Please try again later.')
    );
  } catch (error) {
    console.error('❌ Error opening feedback email:', error);
    Alert.alert('Error', 'Could not prepare the email. Please try again.');
  }
};

// Opens one of GAME.otherApps. Takes the app record rather than hardcoding a
// destination, because the two functions this replaces — handleBloxFruit and
// handleadoptme — were each named for one app and pointed at a different one.
export const openOtherApp = (app) => {
  const url = Platform.OS === 'ios' ? (app?.ios || app?.android) : app?.android;
  if (!url) return;
  Linking.openURL(url).catch(() =>
    Alert.alert('Error', 'Unable to open the app store. Please try again later.')
  );
};

  export const handleRateApp = () => {
    const storeLink =
      Platform.OS === 'ios'
        ? config.IOsShareLink
        : config.andriodShareLink;
    Linking.openURL(storeLink).catch(() =>
      Alert.alert('Error', 'Unable to open the app store. Please try again later.')
    );
  };

  export const handleOpenFacebook = () => {
    const facebookUrl = 'https://www.facebook.com/share/g/15V1JErjbY/';
    Linking.openURL(facebookUrl).catch(() =>
      Alert.alert('Error', 'Unable to open Facebook. Please try again later.')
    );
  };

  export const handleOpenWebsite = () => {
    const websiteUrl = config.webSite;
    Linking.openURL(websiteUrl).catch(() =>
      Alert.alert('Error', 'Unable to open the website. Please try again later.')
    );
  };

  export const handleOpenPrivacy = () => {
    const websiteUrl = 'https://adoptmevalues.app/privacy-policy/';
    Linking.openURL(websiteUrl).catch(() =>
      Alert.alert('Error', 'Unable to open the website. Please try again later.')
    );
  };

  export const handleOpenChild = () => {
    const websiteUrl = 'https://adoptmevalues.app/child-safety-standards-policy/';
    Linking.openURL(websiteUrl).catch(() =>
      Alert.alert('Error', 'Unable to open the website. Please try again later.')
    );
  };

  export const imageOptions = [
    GAME.defaultAvatar,
    'https://bloxfruitscalc.com/wp-content/uploads/2025/101.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/102.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/103.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/104.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/105.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/106.png',

    'https://bloxfruitscalc.com/wp-content/uploads/2025/107.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/108.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/109.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/110.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/111.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/woman.png',
    
    'https://bloxfruitscalc.com/wp-content/uploads/2025/eagle.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/patch.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/pirate1.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/pirate2.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/pirate3.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/pirate-flag.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/pirate-hat.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/pirate-hat1.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/pirate-ship.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/pirate-ship2.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/pirate-skull.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/pirate.png',
    'https://bloxfruitscalc.com/wp-content/uploads/2025/steering-wheel.png',
  ];
 

  export const handleRefresh = async (reload) => {
    // setRefreshing(true);

    try {
      await reload(); // Re-fetch stock data
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      // setRefreshing(false);
    }
  };

  