import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Calendar from "expo-calendar";
import type { RootStackParamList } from "../../../App";
import EventAttendeeSection from "../../components/EventAttendeeSection";
import { deleteHostedEvent, fetchEventBuckets, leaveEvent, type EventItem } from "../../data/eventStore";

type Props = NativeStackScreenProps<RootStackParamList, "EventDetails">;

export default function EventDetailsScreen({ navigation, route }: Props) {
  const { eventId, source } = route.params;
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState(false);

  const loadEvent = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await fetchEventBuckets();

    if (fetchError || !data) {
      setError(fetchError ?? "Could not load event details.");
      setLoading(false);
      return;
    }

    const sourceEvents =
      source === "attending"
        ? data.attendingEvents
        : source === "hosting"
          ? data.hostingEvents
          : data.pastEvents;
    const matchingEvent = sourceEvents.find((item) => item.id === eventId) ?? null;

    setEvent(matchingEvent);
    setError(matchingEvent ? null : "This event could not be found.");
    setLoading(false);
  }, [eventId, source]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  function openMap() {
    if (!event) {
      return;
    }

    navigation.navigate("LiveEventMap", { eventId: event.id, eventTitle: event.title });
  }

  async function addToCalendar() {
    if (!event?.startAt || !event.endAt) {
      Alert.alert("Calendar unavailable", "This event is missing a start or end time.");
      return;
    }

    const isAvailable = await Calendar.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert("Calendar unavailable", "This device does not support calendar access.");
      return;
    }

    const permission = await Calendar.requestCalendarPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Calendar permission needed", "Calendar access is needed to add this event.");
      return;
    }

    await Calendar.createEventInCalendarAsync({
      title: event.title,
      startDate: event.startAt,
      endDate: event.endAt,
      notes: event.description,
      location: event.place,
    });
  }

  function confirmLeaveEvent() {
    if (!event) {
      return;
    }

    Alert.alert("Leave event?", `Remove yourself from "${event.title}"?`, [
      { text: "Stay", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => void handleLeaveEvent() },
    ]);
  }

  async function handleLeaveEvent() {
    if (!event) {
      return;
    }

    setProcessingAction(true);
    const { error: leaveError } = await leaveEvent(event.id);
    setProcessingAction(false);

    if (leaveError) {
      setError(leaveError);
      return;
    }

    navigation.goBack();
  }

  function confirmDeleteEvent() {
    if (!event) {
      return;
    }

    Alert.alert("Delete event?", `Delete "${event.title}" for everyone? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void handleDeleteEvent() },
    ]);
  }

  async function handleDeleteEvent() {
    if (!event) {
      return;
    }

    setProcessingAction(true);
    const { error: deleteError } = await deleteHostedEvent(event.id);
    setProcessingAction(false);

    if (deleteError) {
      setError(deleteError);
      return;
    }

    navigation.goBack();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="small" />
          <Text style={styles.stateText}>Loading event details...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {event ? (
        <>
          <View style={styles.hero}>
            <View style={styles.heroHeader}>
              <Text style={styles.heroTitle}>{event.title}</Text>
              <View style={[styles.visibilityBadge, event.visibility === "Public" ? styles.publicBadge : styles.privateBadge]}>
                <Text style={styles.visibilityText}>{event.visibility}</Text>
              </View>
            </View>
            <Text style={styles.heroSubtitle}>{event.description}</Text>
            <View style={styles.heroActionRow}>
              <Pressable style={styles.calendarButton} onPress={() => void addToCalendar()} disabled={processingAction}>
                <Text style={styles.calendarButtonText}>Add to calendar</Text>
              </Pressable>

              {source !== "past" ? (
                <Pressable style={styles.primaryButton} onPress={openMap} disabled={processingAction}>
                  <Text style={styles.primaryButtonText}>Map</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.card}>
            <InfoRow label="When" value={event.time} />
            <InfoRow label="Location" value={event.place} />
            <InfoRow label="Hosted by" value={event.host} />
            <InfoRow label="Genre" value={event.genre} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Attending people</Text>
            <EventAttendeeSection eventId={event.id} />
          </View>

          {source === "attending" ? (
            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryButton} onPress={confirmLeaveEvent} disabled={processingAction}>
                <Text style={styles.secondaryButtonText}>{processingAction ? "Leaving..." : "Leave event"}</Text>
              </Pressable>
            </View>
          ) : null}

          {source === "hosting" ? (
            <View style={styles.bottomDangerWrap}>
              <Pressable style={styles.dangerButton} onPress={confirmDeleteEvent} disabled={processingAction}>
                <Text style={styles.dangerButtonText}>{processingAction ? "Deleting..." : "Delete event"}</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f1e8" },
  content: { padding: 20, paddingBottom: 120 },
  hero: {
    backgroundColor: "#fffaf4",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    shadowColor: "#7a5c3d",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
    marginBottom: 14,
  },
  heroHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  heroTitle: { flex: 1, color: "#1f1a17", fontSize: 28, fontWeight: "800" },
  heroSubtitle: { color: "#67594d", fontSize: 15, lineHeight: 22 },
  heroActionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  card: {
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#201c19", marginBottom: 10 },
  infoRow: { paddingVertical: 8 },
  infoLabel: { fontSize: 12, color: "#6f6258", fontWeight: "800", textTransform: "uppercase" },
  infoValue: { marginTop: 4, fontSize: 15, color: "#201c19", fontWeight: "600", lineHeight: 20 },
  visibilityBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  publicBadge: { backgroundColor: "#eef3e8", borderColor: "#d3ddc8" },
  privateBadge: { backgroundColor: "#f3eee7", borderColor: "#e2d6c6" },
  visibilityText: { fontSize: 11, fontWeight: "800", color: "#4f4339" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  bottomDangerWrap: {
    alignItems: "center",
    marginTop: 22,
  },
  calendarButton: {
    backgroundColor: "#2f5d50",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  calendarButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  primaryButton: {
    backgroundColor: "#f6eee4",
    borderColor: "#eadfce",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonText: { color: "#4f4339", fontSize: 13, fontWeight: "800" },
  secondaryButton: {
    backgroundColor: "#f6eee4",
    borderColor: "#eadfce",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: { color: "#4f4339", fontSize: 13, fontWeight: "800" },
  dangerButton: {
    backgroundColor: "#fff1f1",
    borderColor: "#efc7c7",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dangerButtonText: { color: "#a23d3d", fontSize: 13, fontWeight: "800" },
  stateCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stateText: { color: "#6f6258", fontSize: 13 },
  errorCard: {
    backgroundColor: "#fff4f1",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#efd6cf",
    padding: 14,
    marginBottom: 12,
  },
  errorText: { color: "#a23d3d", fontSize: 13, fontWeight: "600" },
});
