import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useGlobalState } from "../GlobelStats";
import config from "../Helper/Environment";
import { ref, get, update, remove } from "@react-native-firebase/database";
import { useTranslation } from "react-i18next";
import { banUserwithEmail } from "./utils";
import { DEFAULT_CHANNEL } from './chatChannels';
import { SIZE } from '../Design/tokens';
import { SPACE } from '../Design/tokens';
import { FONT } from '../Design/tokens';
import { ModalKeyboardView } from '../Helper/keyboardAvoidingContainer';


const ReportPopup = ({ visible, message, onClose, channelPath = DEFAULT_CHANNEL.path }) => {
  const [selectedReason, setSelectedReason] = useState("Spam");
  const [customReason, setCustomReason] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const { theme, appdatabase } = useGlobalState();
  const isDarkMode = theme === "dark";
  const { t } = useTranslation();

  // ✅ Memoize reason options array
  const reasonOptions = useMemo(() => [
    t("chat.spam"),
    t("chat.religious"),
    t("chat.hate_speech")
  ], [t]);

  // ✅ Memoize styles
  const styles = useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  const handleSubmit = () => {
    // ✅ Safety checks
    if (!message || !message.id) {
      Alert.alert(t("home.alert.error"), t("report_popup.invalid_message"));
      return;
    }

    if (!appdatabase) {
      Alert.alert(t("home.alert.error"), t("report_popup.no_db"));
      return;
    }

    const messageId = message.id || '';
    const sanitizedId = messageId.startsWith("chat-")
      ? messageId.replace("chat-", "")
      : messageId;
  
    if (!sanitizedId || sanitizedId.trim().length === 0) {
      Alert.alert(t("home.alert.error"), t("report_popup.invalid_message"));
      return;
    }
  
    setLoading(true);
    // The room the message was reported from. Defaults to English so the
    // trade-report caller, which has no channel, keeps working unchanged.
    const messageRef = ref(appdatabase, `${channelPath}/${sanitizedId}`);
  
    get(messageRef)
      .then((snapshot) => {
        if (!snapshot.exists()) throw new Error("Message not found");
  
        const data = snapshot.val();
        if (!data || typeof data !== 'object') {
          throw new Error("Invalid message data");
        }

        const reportCount = Number(data?.reportCount || 0);
  
        if (reportCount >= 1) {
          // ✅ Second report: delete the message
          // ✅ Await banUserwithEmail to ensure it completes
          if (message.currentUserEmail) {
            banUserwithEmail(message.currentUserEmail).catch((error) => {
              console.error("Error banning user:", error);
            });
          }
          return remove(messageRef).then(() => ({ action: "deleted" }));
        } else {
          // ✅ First report: set to 1 (don't increment beyond this)
          return update(messageRef, { reportCount: 1 }).then(() => ({ action: "reported" }));
        }
      })
      .then((res) => {
        setLoading(false);
        Alert.alert(t("chat.report_submitted"), t("chat.report_submitted_message"));
        onClose(true);
      })
      .catch((error) => {
        console.error("Error reporting message:", error);
        setLoading(false);
        Alert.alert(t("home.alert.error"), t("report_popup.submit_failed"));
      });
  };

  // ✅ Early return if no message
  if (!message) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <ModalKeyboardView style={styles.overlay}>
        <View style={styles.popup}>
          <Text style={styles.title}>{t("report_popup.title")}</Text>
          <Text style={styles.messageText}>{`${t("report_popup.message_label")}: "${message?.text}"`}</Text>
          <Text style={styles.messageText}>{`${t("report_popup.sender_label")}: ${message?.sender || t("private_chat.anonymous")}`}</Text>

          {/* Standard Reasons */}
          <View style={styles.optionsContainer}>
            {reasonOptions.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.option,
                  selectedReason === reason && styles.selectedOption,
                ]}
                onPress={() => {
                  setSelectedReason(reason);
                  setShowCustomInput(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedReason === reason && styles.selectedOptionText,
                  ]}
                >
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Custom Option */}
            <TouchableOpacity
              style={[
                styles.option,
                showCustomInput && styles.selectedOption,
              ]}
              onPress={() => setShowCustomInput(true)}
            >
              <Text
                style={[
                  styles.optionText,
                  showCustomInput && styles.selectedOptionText,
                ]}
              >
                { t("chat.other")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Custom Input for "Other" */}
          {showCustomInput && (
            <TextInput
              style={styles.input}
              placeholder={t("report_popup.custom_reason_placeholder")}
              placeholderTextColor={isDarkMode ? '#999' : '#888'}
              value={customReason}
              onChangeText={setCustomReason}
            />
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>{t("home.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: config.colors.hasBlockGreen },
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}> {t("chat.submit")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ModalKeyboardView>
    </Modal>
  );
};

const getStyles = (isDarkMode) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    popup: {
      width: "80%",
      backgroundColor: isDarkMode ? config.colors.backgroundDark : "#f2f2f7",
      borderRadius: 10,
      padding: SPACE.xxxl,
      elevation: 5,
    },
    title: {
      fontSize: SIZE.subtitle,
      fontFamily: FONT.bold,
      marginBottom: SPACE.lg,
      color: isDarkMode ? "white" : "black",
    },
    messageText: {
      fontSize: SIZE.body,
      color: isDarkMode ? "white" : "black",
      marginBottom: 15,
    },
    optionsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginBottom: SPACE.lg,
    },
    option: {
      paddingHorizontal: 3,
      backgroundColor: "#ddd",
      borderRadius: 10,
      marginRight: SPACE.lg,
      marginBottom: SPACE.lg,
    },
    selectedOption: {
      borderColor: config.colors.primary,
      backgroundColor: config.colors.hasBlockGreen,
    },
    optionText: {
      fontSize: SIZE.body,
      color: isDarkMode ? "#888" : "#444",
      paddingHorizontal: 5,
    },
    selectedOptionText: {
      color: "white",
    },
    input: {
      borderWidth: 1,
      borderColor: "#ddd",
      borderRadius: 5,
      padding: 5,
      marginTop: SPACE.lg,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 15,
    },
    button: {
      paddingVertical: 5,
      paddingHorizontal: SPACE.xxxl,
      backgroundColor: config.colors.primary,
      borderRadius: 5,
    },
    buttonText: {
      color: "white",
      fontSize: SIZE.subtitle,
    },
  });

export default ReportPopup;
