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
import Ionicons from "@expo/vector-icons/Ionicons";
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
  description,
  icon,
  tone,
  onPress,
}: {
  label: string;
  count: number;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "attending" | "hosting" | "past";
  onPress: () => void;
}) {
  const countLabel = count === 1 ? "1 event" : `${count} events`;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.categoryButton, styles[`${tone}Button`], pressed && commonStyles.pressed]}>
      <View style={[styles.iconWrap, styles[`${tone}Icon`]]}>
        <Ionicons name={icon} size={22} color="#ffffff" />
      </View>
      <View style={styles.categoryTextWrap}>
        <Text style={styles.categoryLabel}>{label}</Text>
        <Text style={styles.categoryDescription}>{description}</Text>
      </View>
      <View style={styles.categoryMetaWrap}>
        <Text style={styles.categoryCount}>{countLabel}</Text>
        <Ionicons name="chevron-forward" size={18} color="#4f4339" />
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
      <View style={styles.hero}>
        <View style={styles.heroTextWrap}>
          <Text style={styles.eyebrow}>Events</Text>
          <Text style={styles.title}>Your events</Text>
          <Text style={styles.heroText}>Keep track of what you are attending, hosting, and what has wrapped up.</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("CreateEventDetails")}
          style={({ pressed }) => [styles.createButton, pressed && commonStyles.pressed]}
        >
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.createButtonText}>Create event</Text>
        </Pressable>
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
          description="Events you joined or accepted"
          icon="people"
          tone="attending"
          onPress={() => navigation.navigate("AttendingEvents")}
        />
        <CategoryCard
          label="Hosting"
          count={hostingEvents.length}
          description="Events you created"
          icon="person"
          tone="hosting"
          onPress={() => navigation.navigate("HostingEvents")}
        />
        <CategoryCard
          label="Past"
          count={pastEvents.length}
          description="Finished events"
          icon="time"
          tone="past"
          onPress={() => navigation.navigate("PastEvents")}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 18,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  heroTextWrap: {
    marginBottom: 14,
  },
  eyebrow: {
    color: "#8a6a4a",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 5,
  },
  title: {
    color: colors.textStrong,
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 6,
  },
  heroText: {
    color: colors.textSubtle,
    fontSize: 14,
    lineHeight: 20,
  },
  createButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  createButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  section: { gap: 12, marginBottom: 20 },
  categoryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  attendingButton: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  hostingButton: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pastButton: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  attendingIcon: {
    backgroundColor: "#2f5d50",
  },
  hostingIcon: {
    backgroundColor: "#4f5aa8",
  },
  pastIcon: {
    backgroundColor: "#9a6429",
  },
  categoryTextWrap: { flex: 1 },
  categoryLabel: { fontSize: 17, fontWeight: "800", color: colors.text },
  categoryDescription: {
    marginTop: 3,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  categoryMetaWrap: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 4,
  },
  categoryCount: { fontSize: 13, color: "#4f4339", fontWeight: "900" },
  errorText: { color: "#a23d3d", fontSize: 13, fontWeight: "600" },
});
