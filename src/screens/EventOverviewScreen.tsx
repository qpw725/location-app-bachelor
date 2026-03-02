import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import StepIndicator from "../components/StepIndicator";

type Props = NativeStackScreenProps<RootStackParamList, "EventOverview">;

const categoryOptions = ["Relaxed social", "Games and drinks", "Networking", "Fitness"];
const frequencyOptions = ["Low", "Medium", "High"] as const;

export default function EventOverviewScreen({ route }: Props) {
  const { eventName, location, eventTime, eventDate } = route.params;

  const [visibility, setVisibility] = useState<"Private" | "Public">("Private");
  const [selectedCategory, setSelectedCategory] = useState(categoryOptions[0]);
  const [notifyLocationUpdates, setNotifyLocationUpdates] = useState(true);
  const [notifyArrivalUpdates, setNotifyArrivalUpdates] = useState(true);
  const [notificationFrequency, setNotificationFrequency] = useState<(typeof frequencyOptions)[number]>("Medium");
  const [inviteInput, setInviteInput] = useState("");
  const [invitedPeople, setInvitedPeople] = useState<string[]>([]);

  const locationLabel = useMemo(() => {
    const maxLocationLength = 52;
    return location.label.length > maxLocationLength
      ? `${location.label.slice(0, maxLocationLength)}...`
      : location.label;
  }, [location.label]);

  const eventTimeLabel = useMemo(
    () =>
      new Date(0, 0, 0, eventTime.hour, eventTime.minute).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [eventTime.hour, eventTime.minute]
  );

  const eventDateLabel = useMemo(
    () =>
      new Date(eventDate.year, eventDate.month - 1, eventDate.day).toLocaleDateString([], {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [eventDate.day, eventDate.month, eventDate.year]
  );

  function addInvitee() {
    const trimmed = inviteInput.trim();
    if (!trimmed) return;
    setInvitedPeople((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setInviteInput("");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StepIndicator step={3} total={3} label="Finalize" />
      <Text style={styles.title}>Finalize event</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Event summary</Text>
        <Text style={styles.cardText}>Title: {eventName}</Text>
        <Text style={styles.cardText}>Location: {locationLabel}</Text>
        <Text style={styles.cardText}>Date: {eventDateLabel}</Text>
        <Text style={styles.cardText}>Time: {eventTimeLabel}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Event settings</Text>

        <Text style={styles.settingLabel}>Visibility</Text>
        <View style={styles.toggleRow}>
          {(["Private", "Public"] as const).map((option) => (
            <Pressable
              key={option}
              style={[styles.optionChip, visibility === option && styles.optionChipActive]}
              onPress={() => setVisibility(option)}
            >
              <Text style={[styles.optionChipText, visibility === option && styles.optionChipTextActive]}>{option}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.settingLabel}>Category</Text>
        <View style={styles.toggleRow}>
          {categoryOptions.map((option) => (
            <Pressable
              key={option}
              style={[styles.optionChip, selectedCategory === option && styles.optionChipActive]}
              onPress={() => setSelectedCategory(option)}
            >
              <Text style={[styles.optionChipText, selectedCategory === option && styles.optionChipTextActive]}>{option}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.settingLabel}>Notification settings</Text>
        <View style={styles.inlineSettingRow}>
          <Text style={styles.inlineSettingText}>Notify about participant location updates</Text>
          <Pressable
            style={[styles.smallToggle, notifyLocationUpdates && styles.smallToggleActive]}
            onPress={() => setNotifyLocationUpdates((prev) => !prev)}
          >
            <Text style={[styles.smallToggleText, notifyLocationUpdates && styles.smallToggleTextActive]}>
              {notifyLocationUpdates ? "On" : "Off"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.inlineSettingRow}>
          <Text style={styles.inlineSettingText}>Notify when participants are on the way / arrived</Text>
          <Pressable
            style={[styles.smallToggle, notifyArrivalUpdates && styles.smallToggleActive]}
            onPress={() => setNotifyArrivalUpdates((prev) => !prev)}
          >
            <Text style={[styles.smallToggleText, notifyArrivalUpdates && styles.smallToggleTextActive]}>
              {notifyArrivalUpdates ? "On" : "Off"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.settingLabel}>Notification frequency</Text>
        <View style={styles.toggleRow}>
          {frequencyOptions.map((option) => (
            <Pressable
              key={option}
              style={[styles.optionChip, notificationFrequency === option && styles.optionChipActive]}
              onPress={() => setNotificationFrequency(option)}
            >
              <Text style={[styles.optionChipText, notificationFrequency === option && styles.optionChipTextActive]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Invite people</Text>
        <View style={styles.inviteRow}>
          <TextInput
            value={inviteInput}
            onChangeText={setInviteInput}
            placeholder="Add username or email"
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
          />
          <Pressable style={styles.addBtn} onPress={addInvitee}>
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>

        {invitedPeople.length === 0 ? (
          <Text style={styles.placeholderText}>No people added yet.</Text>
        ) : (
          <View style={styles.chipsWrap}>
            {invitedPeople.map((person) => (
              <View key={person} style={styles.personChip}>
                <Text style={styles.personChipText}>{person}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Pressable style={styles.primaryBtn}>
        <Text style={styles.primaryBtnText}>{visibility === "Public" ? "Publish event" : "Create event"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6fb" },
  content: { padding: 20, paddingBottom: 28 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 14, color: "#1a2233" },
  card: {
    borderWidth: 1,
    borderColor: "#d9e2f3",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#ffffff",
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8, color: "#1a2233" },
  cardText: { fontSize: 14, color: "#4f5f78", marginBottom: 4 },
  settingLabel: { fontSize: 14, fontWeight: "700", color: "#1a2233", marginTop: 8, marginBottom: 8 },
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8e1f2",
    backgroundColor: "#f7f9fd",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  optionChipActive: {
    backgroundColor: "#1f4fa3",
    borderColor: "#1f4fa3",
  },
  optionChipText: {
    fontSize: 12,
    color: "#4c5e7b",
    fontWeight: "600",
  },
  optionChipTextActive: {
    color: "#ffffff",
  },
  inlineSettingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 10,
  },
  inlineSettingText: { flex: 1, fontSize: 13, color: "#33415c" },
  smallToggle: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d8e1f2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f7f9fd",
  },
  smallToggleActive: {
    backgroundColor: "#1f4fa3",
    borderColor: "#1f4fa3",
  },
  smallToggleText: { color: "#4c5e7b", fontWeight: "700", fontSize: 12 },
  smallToggleTextActive: { color: "#ffffff" },
  inviteRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d8e1f2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1a2233",
  },
  addBtn: {
    backgroundColor: "#1f4fa3",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnText: { color: "#ffffff", fontWeight: "700" },
  placeholderText: { marginTop: 10, fontSize: 13, color: "#6b7a90" },
  chipsWrap: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  personChip: {
    backgroundColor: "#eef3fb",
    borderWidth: 1,
    borderColor: "#d8e1f2",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  personChipText: { color: "#33415c", fontSize: 12, fontWeight: "600" },
  primaryBtn: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#111",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
