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
import { colors, commonStyles } from "../../styles/common";

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
    <Pressable onPress={onPress} style={({ pressed }) => [commonStyles.card, pressed && commonStyles.pressed]}>
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
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <View style={commonStyles.heroCard}>
        <Text style={commonStyles.heroEyebrow}>Events</Text>
        <Text style={commonStyles.heroTitle}>Your plans</Text>
        <Text style={commonStyles.heroSubtitle}>Keep track of events you are attending, hosting, or have already wrapped up.</Text>
      </View>

      {loadingEvents ? (
        <View style={commonStyles.stateCard}>
          <ActivityIndicator size="small" />
          <Text style={commonStyles.stateText}>Loading events...</Text>
        </View>
      ) : null}

      {eventsError ? (
        <View style={commonStyles.errorCard}>
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
  section: { marginBottom: 20 },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  categoryLabel: { fontSize: 18, fontWeight: "700", color: colors.text },
  categoryCount: { fontSize: 15, color: colors.primary, fontWeight: "800" },
  errorText: { color: "#a23d3d", fontSize: 13, fontWeight: "600" },
});
