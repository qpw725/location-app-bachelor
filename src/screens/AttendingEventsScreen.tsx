import { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet, ActivityIndicator, RefreshControl, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { fetchEventBuckets, type EventItem } from "../data/eventStore";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "AttendingEvents">;

export default function AttendingEventsScreen({ navigation }: Props) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      void loadEvents();
    }, [loadEvents])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Attending</Text>
        <Text style={styles.heroTitle}>Plans you have said yes to</Text>
        <Text style={styles.heroSubtitle}>Accepted invites and joined events live here, ready when you need them.</Text>
      </View>
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
        <Pressable
          key={event.id}
          onPress={() => navigation.navigate("EventDetails", { eventId: event.id, eventTitle: event.title, mode: "attending" })}
          style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}
        >
          <View style={styles.eventSummaryRow}>
            <View style={styles.eventSummaryText}>
              <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
              <Text style={styles.eventMeta} numberOfLines={2}>{event.place}</Text>
            </View>
            <Text style={styles.eventArrow}>›</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
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
    marginBottom: 18,
  },
  heroEyebrow: { color: "#8a6a4a", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  heroTitle: { color: "#1f1a17", fontSize: 28, fontWeight: "800", marginBottom: 8 },
  heroSubtitle: { color: "#67594d", fontSize: 15, lineHeight: 22 },
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
  emptyState: {
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#201c19", marginBottom: 4 },
  emptyText: { fontSize: 13, color: "#6f6258", lineHeight: 20 },
  eventCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 16,
    marginTop: 12,
  },
  eventSummaryRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  eventSummaryText: { flex: 1 },
  eventTitle: { fontSize: 16, fontWeight: "700", color: "#241f1c", marginBottom: 4 },
  eventMeta: { fontSize: 13, color: "#6f6258", lineHeight: 19 },
  eventArrow: { color: "#4f4339", fontSize: 28, fontWeight: "500" },
  pressed: { opacity: 0.88 },
  visibilityBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  publicBadge: { backgroundColor: "#eef3e8", borderColor: "#d3ddc8" },
  privateBadge: { backgroundColor: "#f3eee7", borderColor: "#e2d6c6" },
  visibilityText: { fontSize: 11, fontWeight: "700", color: "#4f4339" },
  metaFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#efe4d7",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaLabel: { fontSize: 12, color: "#4e6258", fontWeight: "600" },
  actionRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#efe4d7",
    flexDirection: "row",
    gap: 10,
  },
  mapButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2f5d50",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mapButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  secondaryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#f6eee4",
    borderColor: "#eadfce",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonDisabled: { opacity: 0.6 },
  secondaryButtonText: { color: "#4f4339", fontSize: 13, fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 24, 40, 0.38)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eadfce",
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#201c19", marginBottom: 8 },
  modalText: { fontSize: 14, color: "#5f5145", lineHeight: 20 },
  modalError: { marginTop: 10, color: "#a23d3d", fontSize: 13, fontWeight: "600" },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  modalSecondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eadfce",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#f6eee4",
  },
  modalSecondaryButtonText: { color: "#4f4339", fontWeight: "700", fontSize: 13 },
  modalDangerButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#efc7c7",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff1f1",
  },
  modalDangerButtonText: { color: "#a23d3d", fontWeight: "700", fontSize: 13 },
});
