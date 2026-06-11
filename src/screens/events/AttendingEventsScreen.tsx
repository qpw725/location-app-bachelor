import { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EventSummaryCard } from "../../components/EventListViews";
import { fetchEventRuntimeStatus, type EventRuntimeStatus } from "../../data/eventRules";
import { fetchEventBuckets, type EventItem } from "../../data/eventStore";
import type { RootStackParamList } from "../../../App";
import { commonStyles } from "../../styles/common";

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
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      {loading ? (
        <View style={commonStyles.stateCard}>
          <ActivityIndicator size="small" />
          <Text style={commonStyles.stateText}>Loading events...</Text>
        </View>
      ) : null}
      {error ? (
        <View style={commonStyles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {!loading && !error && events.length === 0 ? (
        <View style={commonStyles.card}>
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
  errorText: { color: "#a23d3d", fontSize: 13, fontWeight: "600" },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#201c19", marginBottom: 4 },
  emptyText: { fontSize: 13, color: "#6f6258", lineHeight: 20 },
});
