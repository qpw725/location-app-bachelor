import { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EventSummaryCard } from "../../components/EventListViews";
import { fetchEventRuntimeStatus, type EventRuntimeStatus } from "../../data/eventRules";
import { fetchEventBuckets, type EventItem } from "../../data/eventStore";
import type { RootStackParamList } from "../../../App";

type Props = NativeStackScreenProps<RootStackParamList, "AttendingEvents">;

export default function AttendingEventsScreen({ navigation }: Props) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventStatuses, setEventStatuses] = useState<Record<string, EventRuntimeStatus>>({});
  const loadEvents = useCallback(async () => {
    setError(null);
    setEventStatuses({});
    const { data, error: fetchError } = await fetchEventBuckets();
    if (fetchError || !data) {
      setError(fetchError ?? "Could not load attending events.");
      setLoading(false);
      return;
    }
    setEvents(data.attendingEvents);
    setLoading(false);

    const statusPairs = await Promise.all(
      data.attendingEvents
        .filter((event) => event.attendanceEnabled)
        .map(async (event) => {
          const { data: status } = await fetchEventRuntimeStatus({ event, viewerRole: "attending" });
          return status ? ([event.id, status] as const) : null;
        })
    );

    setEventStatuses(Object.fromEntries(statusPairs.filter((pair): pair is readonly [string, EventRuntimeStatus] => pair !== null)));
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
        <EventSummaryCard
          key={event.id}
          event={event}
          runtimeStatus={eventStatuses[event.id] ?? null}
          onPress={() => navigation.navigate("EventDetails", { eventId: event.id, source: "attending" })}
        />
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
});
