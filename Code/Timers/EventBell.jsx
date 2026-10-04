/**
 * Bell toggle for one scheduled event (Black Market, Admin Abuse, Weekly
 * update). Used on the Timers cards and the Home event strip; both read the
 * same state from Code/Helper/eventAlerts.js, so they always agree.
 */
import React, { useState } from 'react';
import { TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { setEventAlert, useEventAlerts } from '../Helper/eventAlerts';
import { showSuccessMessage, showErrorMessage } from '../Helper/MessageHelper';

const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

const EventBell = ({ eventKey, label, color, size = 20, style }) => {
  const { t } = useTranslation();
  const alerts = useEventAlerts();
  const on = !!alerts[eventKey];
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const result = await setEventAlert(eventKey, !on);
    setBusy(false);
    if (result === 'on') {
      showSuccessMessage(
        t('timers.alert_on_title', { defaultValue: 'You’re in!' }),
        t('timers.alert_on', { event: label, defaultValue: 'We’ll notify you when {{event}} starts.' }),
      );
    } else if (result === 'off') {
      showSuccessMessage(
        t('timers.alert_off_title', { defaultValue: 'Alert off' }),
        t('timers.alert_off', { event: label, defaultValue: 'No more {{event}} notifications.' }),
      );
    } else if (result === 'failed') {
      showErrorMessage(
        t('home.alert.error'),
        t('timers.alert_failed', { defaultValue: 'Couldn’t update the alert. Check your connection and try again.' }),
      );
    }
  };

  return (
    <TouchableOpacity
      onPress={toggle}
      hitSlop={HIT}
      style={style}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={t('timers.notify_me', { event: label, defaultValue: 'Notify me when {{event}} starts' })}
    >
      {busy
        ? <ActivityIndicator size="small" color={color} />
        : <Icon name={on ? 'notifications' : 'notifications-outline'} size={size} color={color} />}
    </TouchableOpacity>
  );
};

export default EventBell;
