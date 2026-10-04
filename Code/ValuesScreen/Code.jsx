import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useGlobalState } from '../GlobelStats';
import config from '../Helper/Environment';
import Clipboard from '@react-native-clipboard/clipboard';
import { useHaptic } from '../Helper/HepticFeedBack';
import { t } from 'i18next';
import { showSuccessMessage } from '../Helper/MessageHelper';
import { STATUS } from '../Design/tokens';
import { getThemeColors } from '../Helper/themeColors';
import { SIZE } from '../Design/tokens';
import { SPACE } from '../Design/tokens';
import { FONT } from '../Design/tokens';

const CodesDrawer = ({ isVisible, toggleModal, codes }) => {
  const insets = useSafeAreaInsets();
  // Flatten codes if necessary
  const { theme, analytics } = useGlobalState();
  const isDarkMode = theme === 'dark';
  const { triggerHapticFeedback } = useHaptic();
  // const platform = Platform.OS.toLowerCase();


  const normalizedCodes =
    Array.isArray(codes) && codes.length === 1 && Array.isArray(codes[0])
      ? codes[0]
      : codes;

  // Function to copy the code to the clipboard
  const copyToClipboard = (code) => {
    triggerHapticFeedback('impactLight');
    Clipboard.setString(code); // Copies the code to the clipboard
    showSuccessMessage(t("value.copy"), t("value.copy_success"));

  };

  const renderCodeItem = ({ item }) => (
    // `active: false` means the code no longer works. 75 of 76 are expired, so
    // presenting them all identically would hand the user 75 codes that fail.
    <View style={[styles.codeItem, item.active === false && { opacity: 0.55 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
        <Text style={styles.codeText}>[{item.code}]</Text>
        {item.active === false && (
          <Text style={{ fontSize: SIZE.label, fontFamily: FONT.bold, color: STATUS.danger }}>
            {t('value.expired', { defaultValue: 'EXPIRED' })}
          </Text>
        )}
      </View>
      <View style={styles.rewardContainer}>
        <Text style={styles.rewardText}>{t('value.reward')}: {item.reward}</Text>
        <TouchableOpacity
          onPress={() => copyToClipboard(item.code)}
          style={styles.copyButton}
        >
          <Icon name="copy-outline" size={20} color={STATUS.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const styles = getStyles(isDarkMode);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={toggleModal}
    >
      {/* Overlay */}
      <Pressable style={styles.overlay} onPress={toggleModal} />

      {/* Drawer */}
      <View style={[styles.drawer, { paddingBottom: insets.bottom }]}>
        <FlatList removeClippedSubviews={false}
          data={normalizedCodes}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderCodeItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
          
      </View>
    </Modal>
  );
};

export const getStyles = (isDarkMode, c = getThemeColors(isDarkMode)) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    drawer: {
      backgroundColor: isDarkMode ? config.colors.backgroundDark : '#f2f2f7',
      borderTopLeftRadius: 15,
      borderTopRightRadius: 15,
      padding: SPACE.xxxl,
      position: 'absolute',
      bottom: 0,
      width: '100%',
      maxHeight: '60%',
    },
    headerText: {
      fontSize: SIZE.heading,
      fontFamily: FONT.bold,
      marginBottom: SPACE.lg,
      textAlign: 'center',
    },
    listContainer: {
      paddingBottom: SPACE.xxxl,
    },
    codeItem: {
      paddingVertical: SPACE.lg,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      alignItems: 'center',
    },
    codeText: {
      fontSize: SIZE.subtitle,
      fontFamily: 'Courier', // Monospaced font
      textAlign: 'center',
      marginBottom: 5,
      color: c.text,
    },
    rewardContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    rewardText: {
      fontSize: SIZE.body,
      color: c.textSecondary,
      marginRight: SPACE.lg,
      textAlign: 'center',
      color: c.text,
    },
    copyButton: {
      padding: 5,
    },
  });

export default CodesDrawer;
