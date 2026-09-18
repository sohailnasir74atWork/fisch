import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { rulesen } from '../utils';
import config from '../../Helper/Environment';
import { useTranslation } from 'react-i18next';
import { SIZE } from '../../Design/tokens';
import { SPACE } from '../../Design/tokens';
import { FONT } from '../../Design/tokens';

const ChatRulesModal = ({ visible, onClose, isDarkMode }) => {
  const { t } = useTranslation();
  
  // ✅ Safety check and memoize rules array
  const translatedRules = t('chat_rules.rules', { returnObjects: true });
  const rules = useMemo(() => {
    return Array.isArray(translatedRules) ? translatedRules : (Array.isArray(rulesen) ? rulesen : []);
  }, [translatedRules]);

  // ✅ Memoize modal background color
  const modalBgColor = useMemo(() => 
    isDarkMode ? config.colors.backgroundDark : '#fff', 
    [isDarkMode]
  );

  // ✅ Memoize text colors
  const titleColor = useMemo(() => 
    isDarkMode ? '#fff' : '#000', 
    [isDarkMode]
  );

  const ruleTextColor = useMemo(() => 
    isDarkMode ? '#ccc' : '#333', 
    [isDarkMode]
  );

  // ✅ Validate onClose callback
  const handleClose = () => {
    if (onClose && typeof onClose === 'function') {
      onClose();
    }
  };

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: modalBgColor }]}>
          <Text style={[styles.title, { color: titleColor }]}>{t('chat_rules.title')}</Text>
          <ScrollView style={styles.scroll}>
            {rules.map((rule, index) => {
              // ✅ Safety check for rule
              if (!rule || typeof rule !== 'string') return null;
              
              return (
                <Text
                  key={index}
                  style={[styles.ruleText, { color: ruleTextColor }]}
                >
                  {index + 1}. {rule}
                </Text>
              );
            })}
          </ScrollView>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('chat_rules.got_it')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '95%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: SPACE.xxxl,
  },
  title: {
    fontSize: SIZE.heading,
    fontFamily: FONT.bold,
    marginBottom: SPACE.lg,
  },
  scroll: {
    marginBottom: SPACE.xxxl,
  },
  ruleText: {
    fontSize: SIZE.body,
    fontFamily: FONT.regular,
    marginBottom: SPACE.lg,
  },
  closeButton: {
    backgroundColor: config.colors.primary,
    paddingVertical: SPACE.lg,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontFamily: FONT.bold,
    fontSize: SIZE.subtitle,
  },
});

export default ChatRulesModal;
