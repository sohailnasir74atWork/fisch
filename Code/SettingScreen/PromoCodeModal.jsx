/**
 * Redeem a promo code for free Pro days. Opened from Settings and from the
 * paywall footer (Android only — App Store rule 3.1.1 forbids unlocking
 * features with codes outside in-app purchase, and the iOS build has no
 * sign-in to tie a code to anyway).
 *
 * The code is checked server-side (functions/promoCodes.js); this screen only
 * collects it and turns the server's reason into a sentence.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, Pressable,
  ActivityIndicator, StyleSheet, Keyboard, KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useGlobalState } from '../GlobelStats';
import { useLocalState } from '../LocalGlobelStats';
import { getThemeColors } from '../Helper/themeColors';
import { TYPE, SIZE, SPACE, RADIUS, FONT } from '../Design/tokens';
import { redeemPromoCode } from '../Helper/promoCode';
import { showSuccessMessage } from '../Helper/MessageHelper';

const PromoCodeModal = ({ visible, onClose, onNeedSignIn, onRedeemed }) => {
  const { t } = useTranslation();
  const { theme, user } = useGlobalState();
  const { applyPromoPro, localState } = useLocalState();
  const c = getThemeColors(theme === 'dark');
  const s = useMemo(() => makeStyles(c), [c]);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) { setCode(''); setError(null); }
  }, [visible]);

  const signedIn = !!user?.id;
  const promoUntil = localState?.promoProUntil || 0;
  const hasPromo = promoUntil > Date.now();

  const submit = async () => {
    const clean = code.trim();
    if (!clean || busy) return;
    if (!signedIn) { onNeedSignIn?.(); return; }
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    try {
      const { until, days } = await redeemPromoCode(clean);
      applyPromoPro(until);
      showSuccessMessage(
        t('promo.success_title'),
        t('promo.success_body', { count: days, date: dayjs(until).format('D MMM YYYY') }),
      );
      onClose?.();
      onRedeemed?.();
    } catch (err) {
      if (err.reason === 'sign_in') { onNeedSignIn?.(); return; }
      setError(t(`promo.error_${err.reason}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior="padding" style={s.centerer} pointerEvents="box-none">
        <View style={s.card}>
          <TouchableOpacity style={s.close} onPress={onClose} hitSlop={10}>
            <Icon name="close" size={20} color={c.textSecondary} />
          </TouchableOpacity>

          <View style={s.iconWrap}>
            <Icon name="gift-outline" size={26} color={c.accent} />
          </View>
          <Text style={s.title}>{t('promo.title')}</Text>
          <Text style={s.body}>{t('promo.subtitle')}</Text>

          {hasPromo && (
            <Text style={s.active}>
              {t('promo.active_until', { date: dayjs(promoUntil).format('D MMM YYYY') })}
            </Text>
          )}

          {signedIn ? (
            <>
              <TextInput
                value={code}
                onChangeText={v => { setCode(v.toUpperCase()); setError(null); }}
                placeholder={t('promo.placeholder')}
                placeholderTextColor={c.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={submit}
                editable={!busy}
                style={[s.input, error && { borderColor: c.danger }]}
              />
              {!!error && <Text style={s.error}>{error}</Text>}
              <TouchableOpacity
                style={[s.button, (!code.trim() || busy) && s.buttonDisabled]}
                onPress={submit}
                disabled={!code.trim() || busy}
              >
                {busy
                  ? <ActivityIndicator color={c.onPrimary} />
                  : <Text style={s.buttonText}>{t('promo.redeem')}</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.hint}>{t('promo.sign_in_first')}</Text>
              <TouchableOpacity style={s.button} onPress={onNeedSignIn}>
                <Text style={s.buttonText}>{t('promo.sign_in')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const makeStyles = (c) => StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: c.overlay },
  centerer: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACE.xxxl },
  card: {
    backgroundColor: c.bgElevated,
    borderRadius: RADIUS.xl,
    padding: SPACE.xxxl,
    alignItems: 'center',
  },
  close: { position: 'absolute', top: SPACE.lg, right: SPACE.lg },
  iconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: c.accentTint,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACE.lg,
  },
  title: { ...TYPE.heading, color: c.text, textAlign: 'center' },
  body: { ...TYPE.body, color: c.textSecondary, textAlign: 'center', marginTop: SPACE.xs },
  active: { ...TYPE.callout, color: c.success, textAlign: 'center', marginTop: SPACE.lg },
  hint: { ...TYPE.body, color: c.textSecondary, textAlign: 'center', marginTop: SPACE.xxl },
  input: {
    alignSelf: 'stretch',
    marginTop: SPACE.xxl,
    borderWidth: 1,
    borderColor: c.inputBorder,
    backgroundColor: c.inputBg,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.lg,
    fontSize: SIZE.subtitle,
    fontFamily: FONT.bold,
    letterSpacing: 2,
    textAlign: 'center',
    color: c.text,
  },
  error: { ...TYPE.caption, color: c.danger, textAlign: 'center', marginTop: SPACE.sm },
  button: {
    alignSelf: 'stretch',
    marginTop: SPACE.xxl,
    backgroundColor: c.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACE.xl,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { ...TYPE.callout, color: c.onPrimary },
});

export default PromoCodeModal;
