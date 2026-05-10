import { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../../../App";
import { fetchEventBuckets, type EventItem } from "../../data/eventStore";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "MyEvents">,
  NativeStackScreenProps<RootStackParamList>
>;

function CategoryCard({
  label,
  count,
  onPress,
}: {
  label: string;
  count: number;
  onPress: () => void;
}) {
  const countLabel = count === 1 ? "1 event" : `${count} events`;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.categoryCard, pressed && styles.pressed]}>
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryLabel}>{label}</Text>
        <Text style={styles.categoryCount}>{countLabel}</Text>
      </View>
    </Pressable>
  );
}

export default function MyEventsScreen({ navigation }: Props) {
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [invitedEvents, setInvitedEvents] = useState<EventItem[]>([]);
  const [hostingEvents, setHostingEvents] = useState<EventItem[]>([]);
  const [pastEvents, setPastEvents] = useState<EventItem[]>([]);

  const loadEvents = useCallback(async () => {
    setEventsError(null);
    const { data, error } = await fetchEventBuckets();
    if (error || !data) {
      setEventsError(error ?? "Could not load events.");
      setLoadingEvents(false);
      return;
    }

    setInvitedEvents(data.attendingEvents);
    setHostingEvents(data.hostingEvents);
    setPastEvents(data.pastEvents);
    setLoadingEvents(false);
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
        <Text style={styles.heroEyebrow}>Events</Text>
        <Text style={styles.heroTitle}>Your plans</Text>
        <Text style={styles.heroSubtitle}>Keep track of events you are attending, hosting, or have already wrapped up.</Text>
      </View>

      {loadingEvents ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="small" />
          <Text style={styles.stateText}>Loading events...</Text>
        </View>
      ) : null}

      {eventsError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{eventsError}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <CategoryCard
          label="Attending"
          count={invitedEvents.length}
          onPress={() => navigation.navigate("AttendingEvents")}
        />
        <CategoryCard
          label="Hosting"
          count={hostingEvents.length}
          onPress={() => navigation.navigate("HostingEvents")}
        />
        <CategoryCard
          label="Past"
          count={pastEvents.length}
          onPress={() => navigation.navigate("PastEvents")}
        />
      </View>
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
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
    marginBottom: 24,
  },
  heroEyebrow: {
    color: "#8a6a4a",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroTitle: { color: "#1f1a17", fontSize: 28, fontWeight: "800", marginBottom: 8 },
  heroSubtitle: { color: "#67594d", fontSize: 15, lineHeight: 22, maxWidth: "92%" },
  section: { marginBottom: 20 },
  categoryCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 16,
    marginBottom: 12,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  categoryLabel: { fontSize: 18, fontWeight: "700", color: "#201c19" },
  categoryCount: { fontSize: 15, color: "#2f5d50", fontWeight: "800" },
  pressed: { opacity: 0.88 },
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
