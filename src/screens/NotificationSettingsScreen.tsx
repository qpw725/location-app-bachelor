import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  fetchCurrentProfile,
  updateEventNotificationsPreference,
} from "../profile";
import { registerPushTokenForCurrentUser } from "../notifications";

export default function NotificationSettingsScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [eventNotificationsEnabled, setEventNotificationsEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const { profile, error } = await fetchCurrentProfile();

    if (error) {
      setErrorMessage(error);
      setIsLoading(false);
      return;
    }

    setEventNotificationsEnabled(profile?.eventNotificationsEnabled ?? true);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSettings();
    }, [loadSettings])
  );

  async function handleToggle() {
    const nextValue = !eventNotificationsEnabled;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (nextValue) {
      const registerResult = await registerPushTokenForCurrentUser({ promptIfNeeded: true });
      if (registerResult.error) {
        setErrorMessage(registerResult.error);
        setIsSaving(false);
        return;
      }
    }

    const { error } = await updateEventNotificationsPreference(nextValue);

    if (error) {
      setErrorMessage(error);
      setIsSaving(false);
      return;
    }

    setEventNotificationsEnabled(nextValue);
    setSuccessMessage(nextValue ? "Event notifications turned on." : "Event notifications turned off.");
    setIsSaving(false);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Notifications</Text>
        <Text style={styles.title}>Choose how much event activity you want to hear about</Text>
        <Text style={styles.heroText}>
          This controls whether you receive event updates like arrivals and on-the-way activity.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="small" color="#2f5d50" />
          <Text style={styles.stateText}>Loading your notification settings...</Text>
        </View>
      ) : (
        <View style={styles.settingCard}>
          <View style={styles.settingHeader}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>Receive event notifications</Text>
              <Text style={styles.settingDescription}>
                Get updates when people are on the way, arrive, or other event activities.
              </Text>
            </View>

            <Pressable
              style={[
                styles.toggleButton,
                eventNotificationsEnabled && styles.toggleButtonActive,
                isSaving && styles.toggleButtonDisabled,
              ]}
              onPress={() => void handleToggle()}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  eventNotificationsEnabled && styles.toggleButtonTextActive,
                ]}
              >
                {isSaving ? "Saving..." : eventNotificationsEnabled ? "On" : "Off"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f1e8",
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  heroCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eadfce",
    shadowColor: "#7a5c3d",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  heroEyebrow: {
    color: "#8a6a4a",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1f1a17",
    marginBottom: 8,
  },
  heroText: {
    color: "#67594d",
    fontSize: 15,
    lineHeight: 22,
  },
  stateCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 18,
    alignItems: "center",
  },
  stateText: {
    marginTop: 10,
    color: "#6f6258",
    fontSize: 14,
  },
  settingCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 18,
  },
  settingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  settingTextWrap: {
    flex: 1,
  },
  settingTitle: {
    color: "#201c19",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  settingDescription: {
    color: "#67594d",
    fontSize: 14,
    lineHeight: 20,
  },
  toggleButton: {
    minWidth: 74,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eadfce",
    backgroundColor: "#f6eee4",
  },
  toggleButtonActive: {
    backgroundColor: "#2f5d50",
    borderColor: "#2f5d50",
  },
  toggleButtonDisabled: {
    opacity: 0.7,
  },
  toggleButtonText: {
    color: "#5f5145",
    fontSize: 13,
    fontWeight: "800",
  },
  toggleButtonTextActive: {
    color: "#ffffff",
  },
  errorText: {
    marginTop: 14,
    fontSize: 14,
    color: "#c53535",
    backgroundColor: "#fff4f1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  successText: {
    marginTop: 14,
    fontSize: 14,
    color: "#2f5d50",
    backgroundColor: "#eef3e8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
