import { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet, ActivityIndicator, RefreshControl, Pressable, Modal } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import EventAttendeeSection from "../components/EventAttendeeSection";
import { fetchEventBuckets, leaveEvent, type EventItem } from "../data/eventStore";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "AttendingEvents">;

export default function AttendingEventsScreen({ navigation }: Props) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingEventId, setProcessingEventId] = useState<string | null>(null);
  const [eventToLeave, setEventToLeave] = useState<EventItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await fetchEventBuckets();
    if (fetchError || !data) {
      setError(fetchError ?? "Could not load attending events.");
      setLoading(false);
      return;
    }
    setEvents(data.attendingEvents);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  const handleLeave = useCallback(
    async (eventId: string) => {
      setActionError(null);
      setProcessingEventId(eventId);
      const { error: leaveError } = await leaveEvent(eventId);
      if (leaveError) {
        setActionError(leaveError);
        setProcessingEventId(null);
        return;
      }
      await loadEvents();
      setEventToLeave(null);
      setProcessingEventId(null);
    },
    [loadEvents]
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <Text style={styles.sectionTitle}>Attending</Text>
      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="small" />
          <Text style={styles.stateText}>Loading events...</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {!loading && !error && events.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No attending events yet</Text>
          <Text style={styles.emptyText}>Accepted invites and joined public events will show up here.</Text>
        </View>
      ) : null}
      {events.map((event) => (
        <View key={event.id} style={styles.eventCard}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <View style={[styles.visibilityBadge, event.visibility === "Public" ? styles.publicBadge : styles.privateBadge]}>
              <Text style={styles.visibilityText}>{event.visibility}</Text>
            </View>
          </View>
          <Text style={styles.eventDescription}>{event.description}</Text>
          <Text style={styles.eventMeta}>{event.time}</Text>
          <Text style={styles.eventMeta}>{event.place}</Text>
          <View style={styles.metaFooter}>
            <Text style={styles.metaLabel}>{event.host}</Text>
            <Text style={styles.metaLabel}>{event.genre}</Text>
          </View>
          <EventAttendeeSection eventId={event.id} />
          <View style={styles.actionRow}>
            <Pressable
              style={styles.mapButton}
              onPress={() => navigation.navigate("EventMap", { eventId: event.id, eventTitle: event.title })}
            >
              <Text style={styles.mapButtonText}>Map</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, processingEventId === event.id && styles.secondaryButtonDisabled]}
              onPress={() => {
                setActionError(null);
                setEventToLeave(event);
              }}
              disabled={processingEventId !== null}
            >
              <Text style={styles.secondaryButtonText}>
                {processingEventId === event.id ? "Leaving..." : "Leave event"}
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Modal visible={eventToLeave !== null} transparent animationType="fade" onRequestClose={() => setEventToLeave(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Leave event?</Text>
            <Text style={styles.modalText}>
              {eventToLeave ? `Remove yourself from "${eventToLeave.title}"?` : ""}
            </Text>
            {actionError ? <Text style={styles.modalError}>{actionError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondaryButton}
                onPress={() => {
                  if (processingEventId === null) {
                    setEventToLeave(null);
                    setActionError(null);
                  }
                }}
                disabled={processingEventId !== null}
              >
                <Text style={styles.modalSecondaryButtonText}>Stay</Text>
              </Pressable>
              <Pressable
                style={[styles.modalDangerButton, processingEventId !== null && styles.secondaryButtonDisabled]}
                onPress={() => {
                  if (eventToLeave) {
                    void handleLeave(eventToLeave.id);
                  }
                }}
                disabled={processingEventId !== null}
              >
                <Text style={styles.modalDangerButtonText}>
                  {processingEventId !== null ? "Leaving..." : "Leave"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6fb" },
  content: { padding: 20, paddingBottom: 28 },
  sectionTitle: { fontSize: 22, fontWeight: "700", color: "#1a2233", marginBottom: 12 },
  stateCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stateText: { color: "#5d6a80", fontSize: 13 },
  errorCard: {
    backgroundColor: "#fff4f4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f2d5d5",
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: "#a23d3d", fontSize: 13, fontWeight: "600" },
  emptyState: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    padding: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#1a2233", marginBottom: 4 },
  emptyText: { fontSize: 13, color: "#5d6a80" },
  eventCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    padding: 14,
    marginTop: 10,
  },
  eventHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  eventTitle: { fontSize: 16, fontWeight: "700", color: "#1a2233", marginBottom: 4, flex: 1, marginRight: 8 },
  eventDescription: { fontSize: 13, color: "#4c5e7b", marginBottom: 6 },
  eventMeta: { fontSize: 13, color: "#5d6a80" },
  visibilityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  publicBadge: { backgroundColor: "#ecf7ee", borderColor: "#b9e0bf" },
  privateBadge: { backgroundColor: "#f3f0ff", borderColor: "#d6cdfa" },
  visibilityText: { fontSize: 11, fontWeight: "700", color: "#33415c" },
  metaFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#edf1f8",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaLabel: { fontSize: 12, color: "#3f4e68", fontWeight: "600" },
  actionRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#edf1f8",
    flexDirection: "row",
    gap: 10,
  },
  mapButton: {
    alignSelf: "flex-start",
    backgroundColor: "#1f4fa3",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  mapButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#f7f9fd",
    borderColor: "#d8e1f2",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: "#33415c",
    fontSize: 13,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 24, 40, 0.38)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e4eaf5",
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#1a2233", marginBottom: 8 },
  modalText: { fontSize: 14, color: "#4c5e7b", lineHeight: 20 },
  modalError: { marginTop: 10, color: "#a23d3d", fontSize: 13, fontWeight: "600" },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  modalSecondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d8e1f2",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#f7f9fd",
  },
  modalSecondaryButtonText: { color: "#33415c", fontWeight: "700", fontSize: 13 },
  modalDangerButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#efc7c7",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff1f1",
  },
  modalDangerButtonText: { color: "#a23d3d", fontWeight: "700", fontSize: 13 },
});
