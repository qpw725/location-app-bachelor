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
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Past</Text>
        <Text style={styles.heroTitle}>Moments you have already wrapped up</Text>
        <Text style={styles.heroSubtitle}>A simple history of completed events you hosted or attended.</Text>
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
  eventHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  eventTitle: { fontSize: 16, fontWeight: "700", color: "#241f1c", marginBottom: 4, flex: 1, marginRight: 8 },
  eventDescription: { fontSize: 13, color: "#5f5145", marginBottom: 6, lineHeight: 19 },
  eventMeta: { fontSize: 13, color: "#6f6258" },
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
});
