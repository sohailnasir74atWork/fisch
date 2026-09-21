import React, { useState } from "react";
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
import { ref, push } from "@react-native-firebase/database";
import { SIZE } from '../Design/tokens';
import { SPACE } from '../Design/tokens';
import { FONT } from '../Design/tokens';
import { ModalKeyboardView } from '../Helper/keyboardAvoidingContainer';

const ReportTradePopup = ({ visible, trade, onClose }) => {
  const [selectedReason, setSelectedReason] = useState("Inappropriate");
  const [customReason, setCustomReason] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const { theme, user, appdatabase } = useGlobalState();
  const isDarkMode = theme === "dark";

  const handleSubmit = () => {
    if (showCustomInput && !customReason.trim()) {
      Alert.alert("Error", "Please enter a reason for reporting.");
      return;
    }

    if (!trade?.id) {
      Alert.alert("Error", "Invalid trade. Unable to report.");
      return;
    }

    setLoading(true);

    
    const reportsRef = ref(appdatabase, "tradeReports"); // New node for trade reports
    const reportData = {
      tradeId: trade.id,
      reportedBy: user?.id,
      reason: showCustomInput ? customReason : selectedReason,
      timestamp: Date.now(),
    };

    push(reportsRef, reportData)
      .then(() => {
        setLoading(false); // Stop loader
        Alert.alert(
          "Report Submitted",
          `Trade ID: ${trade.id}\nReason: ${showCustomInput ? customReason : selectedReason
          }\nThank you for reporting this trade.`
        );
        onClose(true); // Indicate success
      })
      .catch((error) => {
        console.error("Error reporting trade:", error);
        setLoading(false); // Stop loader
        Alert.alert("Error", "Failed to submit the report. Please try again.");
      });
  };

  const styles = getStyles(isDarkMode);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <ModalKeyboardView style={styles.overlay}>
        <View style={styles.popup}>
          <Text style={styles.title}>Report Trade</Text>
          <Text style={styles.messageText}>{`Trade ID: ${trade?.id || "Anonymous"}`}</Text>
          <Text style={styles.messageText}>{`Trader: ${trade?.traderName || "Anonymous"}`}</Text>

          <View style={styles.optionsContainer}>
            {["Inappropriate", "Fraud"].map((reason) => (
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
                Other
              </Text>
            </TouchableOpacity>
          </View>

          {showCustomInput && (
            <TextInput
              style={styles.input}
              placeholder="Enter custom reason"
              placeholderTextColor={isDarkMode ? '#999' : '#888'}
              value={customReason}
              onChangeText={setCustomReason}
            />
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>Cancel</Text>
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
                <Text style={styles.buttonText}>Submit</Text>
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
      backgroundColor: config.colors.overlayDark,
      justifyContent: "center",
      alignItems: "center",
    },
    popup: {
      width: "90%",
      backgroundColor: isDarkMode ? config.colors.surfaceDark : config.colors.surfaceLight,
      borderRadius: 10,
      padding: SPACE.xxxl,
      elevation: 5,
    },
    title: {
      fontSize: SIZE.subtitle,
      fontFamily: FONT.bold,
      marginBottom: SPACE.lg,
      color: isDarkMode ? config.colors.textDark : config.colors.textLight,
    },
    messageText: {
      fontSize: SIZE.body,
      color: isDarkMode ? config.colors.textDark : config.colors.textLight,
      marginBottom: 15,
    },
    optionsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginBottom: SPACE.lg,
    },
    option: {
      paddingHorizontal: 3,
      backgroundColor: isDarkMode ? config.colors.surfaceElevatedDark : config.colors.dividerLight,
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
      color: isDarkMode ? config.colors.textTertiaryDark : config.colors.textSecondaryLight,
      paddingHorizontal: 5,
    },
    selectedOptionText: {
      color: config.colors.white,
    },
    input: {
      borderWidth: 1,
      borderColor: isDarkMode ? config.colors.borderDark : config.colors.borderLight,
      backgroundColor: isDarkMode ? config.colors.surfaceDark : config.colors.surfaceLight,
      color: isDarkMode ? config.colors.textDark : config.colors.textLight,
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
      color: config.colors.white,
      fontSize: SIZE.subtitle,
    },
  });

export default ReportTradePopup;
