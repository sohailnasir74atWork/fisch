import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Image,
  Modal,
} from 'react-native';
import { useGlobalState } from '../GlobelStats';
import SignInDrawer from '../Firebase/SigninDrawer';
import SubscriptionScreen from '../SettingScreen/OfferWall';
import config from '../Helper/Environment';
import { useTranslation } from 'react-i18next';
import {  GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { mixpanel } from './MixPenel';
import { useLocalState } from '../LocalGlobelStats';
import { STATUS } from '../Design/tokens';
import { SIZE } from '../Design/tokens';
import { SPACE } from '../Design/tokens';
import { FONT } from '../Design/tokens';

const { width } = Dimensions.get('window');

// This app's own mark. It was MM2's red wordmark until now, behind a
// config.isNoman ternary whose two branches loaded the same file (one via a
// `assets//` double slash) — so a new Fisch user's first screen showed
// another app's logo, and the flag that was supposed to switch it did nothing.
// Onboarding logo, per theme. NOTE the naming reads backwards: "-dark" means
// the logo drawn FOR a dark background (white/blue ink), so it is the one dark
// mode uses. Both are transparent PNGs; assets/logo.webp — the previous source
// here — is the same mark baked onto an opaque square tile, which is why it
// showed as a card rather than a logo.
const iconForLightMode = require('../../assets/brand/bootsplash-logo.png');
const iconForDarkMode = require('../../assets/brand/bootsplash-logo-dark.png');


const OnboardingScreen = ({ onFinish, selectedTheme }) => {
  const insets = useSafeAreaInsets();
  const [screenIndex, setScreenIndex] = useState(0);
  const [openSignin, setOpenSignin] = useState(false);
  const { theme, user, single_offer_wall } = useGlobalState();
  const isDarkMode = theme === 'dark' || selectedTheme === 'dark';
  const icon = isDarkMode ? iconForDarkMode : iconForLightMode;
  const { t } = useTranslation();
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  // const platform = Platform.OS.toLowerCase();
  const { updateLocalState, localState } = useLocalState();
  


  // const languageOptions = [
  //   { code: "en", label: t("settings.languages.en"), flag: "🇺🇸" },
  //   { code: "fil", label: t("settings.languages.fil"), flag: "🇵🇭" },
  //   { code: "vi", label: t("settings.languages.vi"), flag: "🇻🇳" },
  //   { code: "pt", label: t("settings.languages.pt"), flag: "🇵🇹" },
  //   { code: "id", label: t("settings.languages.id"), flag: "🇮🇩" },
  //   { code: "es", label: t("settings.languages.es"), flag: "🇪🇸" },
  //   { code: "fr", label: t("settings.languages.fr"), flag: "🇫🇷" },
  //   { code: "de", label: t("settings.languages.de"), flag: "🇩🇪" },
  //   { code: "ru", label: t("settings.languages.ru"), flag: "🇷🇺" },
  //   { code: "ar", label: t("settings.languages.ar"), flag: "🇸🇦" }

  // ];


  const handleNext = () => {
    if (screenIndex === 0) {
      mixpanel.track("New Install");
      setScreenIndex(1);
    } else if (screenIndex === 1) {
      user?.id ? setScreenIndex(2) : setOpenSignin(true);
    } else {
      onFinish();
    }
  };

  const handleGuest = () => {
    mixpanel.track("Go as Guest");
    // if (Platform.OS === 'ios') {
    //   onFinish();
    // } else {
      setScreenIndex(2);
    // }
  };
  
  const handleLoginSuccess = () => {
    setOpenSignin(false);
    // if (Platform.OS === 'ios') {
    //   onFinish();
    // } else {
      setScreenIndex(2);
    // }
  };

  // const createSlideAnimation = (direction) => {
  //   const animatedValue = new Animated.Value(0);
  //   Animated.loop(
  //     Animated.sequence([
  //       Animated.timing(animatedValue, {
  //         toValue: direction * -width * images.length,
  //         duration: 80000,
  //         useNativeDriver: true
  //       }),
  //       Animated.timing(animatedValue, {
  //         toValue: 0,
  //         duration: 0,
  //         useNativeDriver: true
  //       })
  //     ])
  //   ).start();
  //   return animatedValue;
  // };

  // const translateX1 = createSlideAnimation(1);
  // const translateX2 = createSlideAnimation(-1);
  // const translateX3 = createSlideAnimation(1);

  // const renderSlider = (translateX, imageSubset = []) => (
  //   <Animated.View style={{ flexDirection: 'row', transform: [{ translateX }] }}>
  //     {(imageSubset.length > 0 ? [...imageSubset, ...imageSubset, ...imageSubset, ...imageSubset, ...imageSubset, ...imageSubset, ...imageSubset, ...imageSubset] : []).map((img, index) => (
  //       <Image key={index} source={img} style={styles.image} />
  //     ))}
  //   </Animated.View>
  // );

  // const firstSliderImages = images.slice(0, 6);  // First 6 images
  // const secondSliderImages = images.slice(6, 12); // Next 6 images
  // const thirdSliderImages = images.slice(12, 18); // Remaining images (ensure at least 6)




  const renderScreen = () => {
    switch (screenIndex) {
      case 0:
        return (
          <View style={styles.slide}>
            <Image source={icon} style={styles.iconmain} resizeMode="contain" />
            {/* <View>
              <View style={styles.sliderContainer}>{renderSlider(translateX1, firstSliderImages)}</View>
              <View style={styles.sliderContainer}>{renderSlider(translateX2, secondSliderImages)}</View>
              <View style={styles.sliderContainer}>{renderSlider(translateX3, thirdSliderImages)}</View></View> */}
            <View>
              {/* <View style={styles.spacer}></View> */}
              <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#000' }]}>{t('first.welcome_to')}</Text>
              <Text style={[styles.text, { color: isDarkMode ? '#ccc' : '#666' }]}>{t('first.track_pets')}</Text>
            </View>
          </View>
        );
      case 1:
        return (
          <View style={styles.slide}>
            <Image source={icon} style={styles.iconmain} resizeMode="contain" />
            {/* <View>
              <View style={styles.sliderContainer}>{renderSlider(translateX1, firstSliderImages)}</View>
              <View style={styles.sliderContainer}>{renderSlider(translateX2, secondSliderImages)}</View>
              <View style={styles.sliderContainer}>{renderSlider(translateX3, thirdSliderImages)}</View>
              </View> */}
            {/* <View style={styles.spacer}></View> */}
            <View>
              {!user.id && <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#000' }]}>{t("first.signin_or_guest")}</Text>}
              {user?.id && (
                <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#000' }]}>
                  {`${t('first.welcome_user')} ${user?.displayName || 'Anonymous'}`}

                </Text>
              )}

              <Text style={[styles.text, { color: isDarkMode ? '#ccc' : '#666' }]}>{t("first.get_notified_text")}</Text></View>
          </View>

        );
        case 2:
          // if (Platform.OS === 'ios') {
          //   useEffect(() => {
          //     onFinish();
          //   }, []);
          //   return null;
          // }
          return <SubscriptionScreen visible={true} onClose={onFinish} track="On Boarding" oneWallOnly={single_offer_wall} showoffer={!single_offer_wall}/>;
      default:
        return null;
    }
  };

  return (
    // paddingBottom was a hardcoded 50: this screen renders outside
    // NavigationContainer, so before SafeAreaProvider was mounted in index.js
    // there was no inset to read. 50 happens to be near a gesture bar and is
    // wrong for 3-button navigation, which is why the Continue button sat under
    // the system bar. Padding top too — nothing else on this screen does.
    <GestureHandlerRootView
      style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View style={[styles.container, { backgroundColor: isDarkMode ? config.colors.backgroundDark : '#f2f2f7',  }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={isDarkMode ? config.colors.backgroundDark : '#f2f2f7'} />
        {renderScreen()}
        

        {screenIndex !== 2 && <View style={styles.bottomContainer}>
        {/* {screenIndex === 0 && (
  
  <TouchableOpacity
      style={!localState.isGG ? styles.buttonOutline : styles.buttonOutline}
      onPress={() => updateLocalState('isGG', false)}
    >
      <Text style={!localState.isGG ? styles.buttonTextOutline : styles.buttonTextOutline}>
      ELVEBREDD VALUES
      </Text>
    </TouchableOpacity>


)} */}
 {/* {screenIndex === 0 && (
  
  <TouchableOpacity
      style={localState.isGG ? styles.button : styles.buttonOutline}
      onPress={() => updateLocalState('isGG', true)}
    >
      <Text style={localState.isGG ? styles.buttonText : styles.buttonTextOutline}>
        GG VALUES
      </Text>
    </TouchableOpacity>
)} */}

         
          <TouchableOpacity style={styles.button} onPress={handleNext}>
            <Text style={styles.buttonText}>{screenIndex === 1 && !user.id ? t("first.signin") : t("first.continue")}</Text>
          </TouchableOpacity>
          {screenIndex === 1 && !user?.id && (
            <TouchableOpacity style={styles.buttonOutline} onPress={handleGuest}>
              <Text style={styles.buttonTextOutline}>{t("first.guest_user")}</Text>
            </TouchableOpacity>
          )}
        </View>}

        <SignInDrawer visible={openSignin} onClose={handleLoginSuccess}  selectedTheme={selectedTheme} screen='On Boarding'/>
        <Modal visible={languageModalVisible} animationType="slide" transparent>
          <View style={[styles.modalContainer, { backgroundColor: isDarkMode ? config.colors.backgroundDark : '#f2f2f7' }]}>
            {/* <Text style={[styles.modalTitle, { color: isDarkMode ? 'white' : '#666' }]}>{t("settings.select_language")}</Text>
            <FlatList
              data={languageOptions}
              keyExtractor={(item) => item.code}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.languageOption}
                  onPress={() => {
                    changeLanguage(item.code);
                    setAppLanguage(item.code);
                    setLanguageModalVisible(false);

                  }}
                >
                  <Text style={[styles.languageText, { color: isDarkMode ? 'white' : '#666' }]}>{item.flag} {item.label}</Text>
                </TouchableOpacity>
              )}
            /> */}
          </View>
          <Ionicons name="close" size={34} color={isDarkMode ? '#ccc' : '#666'} style={styles.skipButton} onPress={() => { setLanguageModalVisible(false) }} />
        </Modal>

      </View>
    </GestureHandlerRootView>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: { width: width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xxxl,  flex: 1, marginBottom:30 },
  title: { fontSize: SIZE.title, fontFamily: FONT.bold, marginBottom: SPACE.lg, textAlign: 'center', lineHeight: 30},
  text: { fontSize: SIZE.caption, textAlign: 'center', paddingHorizontal: SPACE.xxxl, fontFamily: FONT.regular },
  welcomeText: { fontSize: SIZE.subtitle, fontFamily: FONT.bold, marginBottom: SPACE.lg, textAlign: 'center' },
  button: { backgroundColor: config.colors.hasBlockGreen, paddingVertical: SPACE.xl, paddingHorizontal: SPACE.xxxl, borderRadius: 12, marginBottom: SPACE.lg, width: '90%', alignItems: 'center', borderColor: config.colors.hasBlockGreen, borderWidth: 2, },
  buttonText: { color: '#fff', fontSize: SIZE.body, textAlign: 'center', fontFamily: FONT.bold },
  buttonOutline: { borderColor: config.colors.hasBlockGreen, borderWidth: 2, paddingVertical: SPACE.xl, paddingHorizontal: SPACE.xxxl, borderRadius: 12, width: '90%', alignItems: 'center', marginBottom: SPACE.lg },
  buttonTextOutline: { color: config.colors.hasBlockGreen, fontSize: SIZE.body, textAlign: 'center', fontFamily: FONT.bold },
  skipButton: { position: 'absolute', top: 40, right: 20, zIndex: 10 },
  skipButtonText: { fontSize: SIZE.subtitle, fontFamily: FONT.bold },
  image: { width: 50, height: 50, margin: SPACE.lg, borderRadius: 10 },
  bottomContainer: {
    position: 'absolute',
    bottom: 10,
    width: '100%',
    alignItems: 'center',
  },
  spacer: {
    height: 100
  },
  benefitsContainer: {
    width: '100%',
    marginTop: SPACE.xxxl,
    alignItems: 'center',
  },

  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: SPACE.xxl,
    borderRadius: 12,
    width: '90%',
    marginBottom: SPACE.lg,
  },

  icon: {
    marginRight: SPACE.xl,
  },

  benefitText: {
    fontSize: SIZE.subtitle,
    color: '#fff',
    fontFamily: FONT.bold
  },
  sliderContainer: {
    paddingVertical: 5
  },
  iconmain: {
    // position: 'absolute',
    // top: 100,
    // No borderRadius: the logo is a transparent PNG, not a square tile, so a
    // corner radius would only clip the hook's ends.
    width: 150,
    alignItems: 'center',
    height: 150,
    // paddingTop: 50
  },
  languageButton: {
    alignSelf: 'center',
    marginTop: SPACE.xxxl,
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.xxxl,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: STATUS.primary,
  },
  languageButtonText: {
    fontSize: SIZE.subtitle,
    color: STATUS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width,
    height: '100%',
    backgroundColor: 'white',
    // borderRadius: 12,
    padding: SPACE.xxxl,
    paddingTop: 80,

    // alignItems: 'center',
  },
  modalTitle: {
    fontSize: SIZE.heading,
    fontFamily: FONT.bold,
    marginVertical: 15,
    alignSelf: 'center'
  },
  languageOption: {
    paddingVertical: SPACE.xxxl,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    width: '100%',
    alignItems: 'left',
  },
  languageText: {
    fontSize: SIZE.subtitle,
    fontFamily: FONT.bold
  }

});

export default OnboardingScreen;
