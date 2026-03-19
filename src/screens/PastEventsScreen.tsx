import { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import EventAttendeeSection from "../components/EventAttendeeSection";
import { fetchEventBuckets, type EventItem } from "../data/eventStore";

export default function PastEventsScreen() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await fetchEventBuckets();
    if (fetchError || !data) {
      setError(fetchError ?? "Could not load past events.");
      setLoading(false);
      return;
    }
    setEvents(data.pastEvents);
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <Text style={styles.sectionTitle}>Past</Text>
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
          <Text style={styles.emptyTitle}>No past events yet</Text>
          <Text style={styles.emptyText}>Completed hosted and attended events will show up here.</Text>
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
        </View>
      ))}
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
});
