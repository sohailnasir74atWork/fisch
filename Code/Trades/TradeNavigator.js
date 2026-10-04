import React, {  useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, Image } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TradeList from './Trades';
import { useHaptic } from '../Helper/HepticFeedBack';
import PrivateChatScreen from '../ChatScreen/PrivateChat/PrivateChat';
import PrivateChatHeader from '../ChatScreen/PrivateChat/PrivateChatHeader';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/Ionicons';
import config from '../Helper/Environment';
import { useGlobalState } from '../GlobelStats';
import { useNavigation } from '@react-navigation/native';
import NotifierDrawer from './Notifier';
import { SIZE } from '../Design/tokens';
import { SPACE } from '../Design/tokens';
import { FONT } from '../Design/tokens';

const Stack = createNativeStackNavigator();

const HighlightedText = ({ text }) => {
  return (
    <Text style={styles.highlightedText}>{text}</Text>
  );
};

const TradeRulesModal = ({ visible, onClose }) => {
  const { theme } = useGlobalState();
  const isDarkMode = theme === 'dark';


  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackground}>
        <View style={[styles.modalContainer, { backgroundColor: isDarkMode ? config.colors.surfaceDark : 'white' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDarkMode ? 'white' : 'black' }]}>
              How Trading Works in Fisch
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close-circle" size={28} color={isDarkMode ? '#bbb' : '#333'} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.modalText, { color: isDarkMode ? '#ccc' : '#333' }]}>
              {/* Facts from the official wiki's Trading page — see HANDOFF.md §4-5.
                  This used to be Adopt Me's guide (pets, vehicles, trade license). */}
              1. <HighlightedText text="What you can trade:" /> Fish, rod skins, bobbers, boats and gliders. Rods themselves, bait and mutations cannot be traded.{"\n"}{"\n"}
              2. <HighlightedText text="Where:" /> Trade face to face with the in-game Trading Menu, or sell from a booth at the Trade Plaza.{"\n"}{"\n"}
              3. <HighlightedText text="Shady Scrips (S$):" /> The Trade Plaza's currency. Community values for skins, bobbers and boats are quoted in S$.{"\n"}{"\n"}
              4. <HighlightedText text="One scale per trade:" /> S$ and Proto are separate value lists, and fish are worth C$. Never compare a Proto number with an S$ number.{"\n"}{"\n"}
              5. <HighlightedText text="Check first:" /> Put both sides in the calculator to see if a trade is a Win, Fair or Loss before you accept.{"\n"}{"\n"}
              6. <HighlightedText text="Stay safe:" /> Only trade through the game's own trade window, never share your account, and report scammers in the app.{"\n"}
            </Text>
          </ScrollView>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: config.colors.primary }]}
            onPress={onClose}
          >
            <Text style={[styles.closeButtonText, { color: isDarkMode ? 'white' : 'white' }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const TradeStack = ({ selectedTheme }) => {
  const [bannedUsers, setBannedUsers] = useState([]);
  const { triggerHapticFeedback } = useHaptic();
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const { theme } = useGlobalState();
  const isDarkMode = theme === 'dark';
  // const navigation = useNavigation()
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);


  const headerOptions = useMemo(
    () => ({
      headerStyle: { backgroundColor: selectedTheme.colors.background },
      headerTintColor: selectedTheme.colors.text,
      headerTitleStyle: { fontFamily: FONT.bold, fontSize: SIZE.title },
      contentStyle: { backgroundColor: selectedTheme.colors.background },
      freezeOnBlur: true,
      animation: 'fade',
      animationDuration: 300,
    }),
    [selectedTheme]
  );

  const [showMyTrades, setShowMyTrades] = useState(false);

  return (
    <>
      <Stack.Navigator screenOptions={headerOptions}>
        {/* Trade List Screen with Trade Rules Button */}
        <Stack.Screen
          name="TradeScreen"
          component={TradeList}
          initialParams={{ bannedUsers, selectedTheme, showMyTradesOnly: showMyTrades }}
          options={({ navigation }) => ({
            title: showMyTrades ? 'My Trades' : t("tabs.trade"),
            headerRight: () => (
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  onPress={() => {
                    const newVal = !showMyTrades;
                    setShowMyTrades(newVal);
                    navigation.setParams({ showMyTradesOnly: newVal });
                  }}
                  style={{ marginRight: 5 }}
                >
                  <Icon
                    name={showMyTrades ? "person" : "person-outline"}
                    size={24}
                    color={showMyTrades ? config.colors.hasBlockGreen : config.colors.primary}
                  />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('Trade Notifier')} style={{ marginRight: 5 }}>
                  <Icon
                    name="notifications"
                    size={24}
                    color={config.colors.primary}
                  />
                </TouchableOpacity>
          
                <TouchableOpacity onPress={() => setModalVisible(true)} style={{ marginRight: SPACE.md }}>
                  <Icon
                    name="information-circle-outline"
                    size={24}
                    color={config.colors.primary}
                  />
                </TouchableOpacity>
              </View>
            ),
          })}
          
        />

        {/* Private Chat Screen */}
        <Stack.Screen
  name="PrivateChatTrade"
  options={({ route }) => ({
    headerTitle: () => (
      <PrivateChatHeader
        selectedUser={route.params?.selectedUser}
        selectedTheme={selectedTheme}
        bannedUsers={bannedUsers}
        isDrawerVisible={isDrawerVisible}
        setIsDrawerVisible={setIsDrawerVisible}
      />
    ),
  })}
>
  {(props) => (
    <PrivateChatScreen
      {...props}
      bannedUsers={bannedUsers}
      isDrawerVisible={isDrawerVisible}
      setIsDrawerVisible={setIsDrawerVisible}
    />
  )}
</Stack.Screen>
        <Stack.Screen
          name="Trade Notifier"
          component={NotifierDrawer}
         
        />
      </Stack.Navigator>
      

      {/* Trade Rules Modal */}
      <TradeRulesModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACE.xxl,
  },
  modalContainer: {
    width: '98%',
    maxHeight: '90%',
    padding: SPACE.xxxl,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.lg,
  },
  modalTitle: {
    fontSize: SIZE.heading,
    fontFamily: FONT.bold,
  },

  modalText: {
    fontSize: SIZE.body,
    textAlign: 'left',
    fontFamily: FONT.regular,
    lineHeight: 24,
  },
  highlightedText: {
    fontFamily: FONT.bold,
    color: config.colors.primary,
  },
  closeButton: {
    width: '100%',
    paddingVertical: SPACE.lg,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: SIZE.subtitle,
    fontFamily: FONT.bold,
  },
});

export default TradeStack;
