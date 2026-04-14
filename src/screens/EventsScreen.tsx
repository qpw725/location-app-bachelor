import { useState, useMemo, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  PanResponder,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../../App";
import EventAttendeeSection from "../components/EventAttendeeSection";
import { fetchEventBuckets, joinPublicEvent, type EventItem } from "../data/eventStore";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Events">,
  NativeStackScreenProps<RootStackParamList>
>;

function MyEventPreviewCard({ title, description, time, place, host, genre, visibility }: EventItem) {
  return (
    <View style={styles.previewEventCard}>
      <View style={styles.eventHeader}>
        <Text style={styles.eventTitle}>{title}</Text>
        <View style={[styles.visibilityBadge, visibility === "Public" ? styles.publicBadge : styles.privateBadge]}>
          <Text style={styles.visibilityText}>{visibility}</Text>
        </View>
      </View>
      <Text style={styles.eventDescription} numberOfLines={2}>{description}</Text>
      <Text style={styles.eventMeta}>{time}</Text>
      <Text style={styles.eventMeta}>{place}</Text>
      <View style={styles.discoverFooter}>
        <Text style={styles.discoverHost}>{host}</Text>
        <Text style={styles.discoverVibe}>{genre}</Text>
      </View>
    </View>
  );
}

function DiscoverEventCard({
  id,
  title,
  description,
  time,
  place,
  host,
  genre,
  onJoin,
  joining,
}: EventItem & {
  onJoin: () => void;
  joining: boolean;
}) {
  return (
    <View style={styles.discoverCard}>
      <Text style={styles.eventTitle}>{title}</Text>
      <Text style={styles.eventDescription} numberOfLines={3}>{description}</Text>
      <Text style={styles.eventMeta}>{time}</Text>
      <Text style={styles.eventMeta}>{place}</Text>
      <View style={styles.discoverFooter}>
        <Text style={styles.discoverHost}>{host}</Text>
        <Text style={styles.discoverVibe}>{genre}</Text>
      </View>
      <EventAttendeeSection eventId={id} />
      <View style={styles.discoverActionRow}>
        <Pressable
          style={[styles.joinButton, joining && styles.joinButtonDisabled]}
          onPress={onJoin}
          disabled={joining}
        >
          <Text style={styles.joinButtonText}>{joining ? "Joining..." : "Join event"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CategoryCard({
  label,
  count,
  preview,
  onPress,
}: {
  label: string;
  count: number;
  preview?: EventItem;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.categoryCard, pressed && styles.pressed]}>
      <View style={styles.categoryHeader}>
        <View>
          <Text style={styles.categoryLabel}>{label}</Text>
          <Text style={styles.categoryCount}>{count} events</Text>
        </View>
        <Text style={styles.categoryArrow}>{">"}</Text>
      </View>

      {preview ? (
        <View style={styles.previewWrap}>
          <MyEventPreviewCard {...preview} />
        </View>
      ) : (
        <Text style={styles.emptyPreview}>No events yet</Text>
      )}
    </Pressable>
  );
}

export default function EventsScreen({ navigation }: Props) {
  const [activeView, setActiveView] = useState<"myEvents" | "discover">("myEvents");
  const [discoverSearch, setDiscoverSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<"Any" | "Nearby" | "City Center">("Any");
  const [timeFilter, setTimeFilter] = useState<"Any" | "Today" | "This Week">("Any");
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [publicEvents, setPublicEvents] = useState<EventItem[]>([]);
  const [invitedEvents, setInvitedEvents] = useState<EventItem[]>([]);
  const [hostingEvents, setHostingEvents] = useState<EventItem[]>([]);
  const [pastEvents, setPastEvents] = useState<EventItem[]>([]);
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const seeded = [
      "Sports",
      "Fitness",
      "Running",
      "Social",
      "Party",
      "Food & Drinks",
      "Celebration",
      "Study / Work",
      "Outdoor",
      "Games",
      "Wellness",
      "Travel",
      "Culture",
      "Other",
    ];
    const fromEvents = Array.from(
      new Set(publicEvents.concat(invitedEvents).map((event) => event.genre).filter((genre) => genre.length > 0))
    );
    return Array.from(new Set(seeded.concat(fromEvents)));
  }, [invitedEvents, publicEvents]);

  const loadEvents = useCallback(async () => {
    setEventsError(null);
    const { data, error } = await fetchEventBuckets();
    if (error || !data) {
      setEventsError(error ?? "Could not load events.");
      setLoadingEvents(false);
      return;
    }

    setPublicEvents(data.publicEvents);
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

  const filteredDiscoverEvents = publicEvents.filter((event) => {
    const query = discoverSearch.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      event.title.toLowerCase().includes(query) ||
      event.place.toLowerCase().includes(query) ||
      event.host.toLowerCase().includes(query) ||
      event.genre.toLowerCase().includes(query);

    const matchesCategory =
      selectedCategories.length === 0 || selectedCategories.includes(event.genre);

    const lowerPlace = event.place.toLowerCase();
    const matchesLocation =
      locationFilter === "Any" ||
      (locationFilter === "Nearby" && !lowerPlace.includes("city center")) ||
      (locationFilter === "City Center" && lowerPlace.includes("city center"));

    const now = new Date();
    const start = event.startAt;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(todayStart.getDate() + 7);
    const matchesTime =
      timeFilter === "Any" ||
      (timeFilter === "Today" &&
        !!start &&
        start >= todayStart &&
        start < new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + 1)) ||
      (timeFilter === "This Week" && !!start && start >= todayStart && start < weekEnd);

    return matchesSearch && matchesCategory && matchesLocation && matchesTime;
  });

  const discoverList = useMemo(() => {
    const seen = new Set<string>();
    return filteredDiscoverEvents.filter((event) => {
      if (seen.has(event.id)) {
        return false;
      }
      seen.add(event.id);
      return true;
    });
  }, [filteredDiscoverEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  const handleJoinEvent = useCallback(
    async (eventId: string) => {
      setEventsError(null);
      setJoiningEventId(eventId);
      const { error } = await joinPublicEvent(eventId);
      if (error) {
        setEventsError(error);
        setJoiningEventId(null);
        return;
      }

      await loadEvents();
      setJoiningEventId(null);
    },
    [loadEvents]
  );

  function toggleCategory(category: string) {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category]
    );
  }

  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
          return isHorizontalSwipe && Math.abs(gestureState.dx) > 20;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < -50) {
            setActiveView("discover");
            return;
          }

          if (gestureState.dx > 50) {
            setActiveView("myEvents");
          }
        },
      }),
    []
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      {...swipeResponder.panHandlers}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Events</Text>
        <Text style={styles.heroTitle}>Your plans, all in one place, and new ones to explore.</Text>
        <Text style={styles.heroSubtitle}>Browse your own plans or explore public events that match your mood.</Text>
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

      <View style={styles.segmentedControl}>
        <Pressable
          style={[styles.segment, activeView === "myEvents" && styles.segmentActive]}
          onPress={() => setActiveView("myEvents")}
        >
          <Text style={[styles.segmentText, activeView === "myEvents" && styles.segmentTextActive]}>My Events</Text>
        </Pressable>
        <Pressable
          style={[styles.segment, activeView === "discover" && styles.segmentActive]}
          onPress={() => setActiveView("discover")}
        >
          <Text style={[styles.segmentText, activeView === "discover" && styles.segmentTextActive]}>Discover</Text>
        </Pressable>
      </View>

      {activeView === "myEvents" ? (
        <View style={styles.section}>
          <CategoryCard
            label="Attending"
            count={invitedEvents.length}
            preview={invitedEvents[0]}
            onPress={() => navigation.navigate("AttendingEvents")}
          />
          <CategoryCard
            label="Hosting"
            count={hostingEvents.length}
            preview={hostingEvents[0]}
            onPress={() => navigation.navigate("HostingEvents")}
          />
          <CategoryCard
            label="Past"
            count={pastEvents.length}
            preview={pastEvents[0]}
            onPress={() => navigation.navigate("PastEvents")}
          />
        </View>
      ) : (
        <View style={styles.section}>
          <TextInput
            value={discoverSearch}
            onChangeText={setDiscoverSearch}
            placeholder="Search events"
            placeholderTextColor="#7a869b"
            style={styles.searchInput}
          />

          <View style={styles.filterBlock}>
            <Text style={styles.filterLabel}>Categories</Text>
            <View style={styles.filterRow}>
              {categoryOptions.map((category) => (
                <Pressable
                  key={category}
                  style={[
                    styles.filterChip,
                    selectedCategories.includes(category) && styles.filterChipActive,
                  ]}
                  onPress={() => toggleCategory(category)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedCategories.includes(category) && styles.filterChipTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.filterLabel}>Distance / Location</Text>
            <View style={styles.filterRow}>
              {(["Any", "Nearby", "City Center"] as const).map((option) => (
                <Pressable
                  key={option}
                  style={[styles.filterChip, locationFilter === option && styles.filterChipActive]}
                  onPress={() => setLocationFilter(option)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      locationFilter === option && styles.filterChipTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.filterLabel}>Time / Date</Text>
            <View style={styles.filterRow}>
              {(["Any", "Today", "This Week"] as const).map((option) => (
                <Pressable
                  key={option}
                  style={[styles.filterChip, timeFilter === option && styles.filterChipActive]}
                  onPress={() => setTimeFilter(option)}
                >
                  <Text style={[styles.filterChipText, timeFilter === option && styles.filterChipTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Text style={styles.sectionTitle}>Discover public events</Text>
          {discoverList.map((event) => (
            <DiscoverEventCard
              key={event.id}
              {...event}
              joining={joiningEventId === event.id}
              onJoin={() => {
                void handleJoinEvent(event.id);
              }}
            />
          ))}
          {discoverList.length === 0 && (
            <View style={styles.discoverCard}>
              <Text style={styles.eventTitle}>No events match your filters</Text>
              <Text style={styles.eventMeta}>Try changing search text or filters.</Text>
            </View>
          )}
        </View>
      )}
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
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#efe6da",
    borderRadius: 18,
    padding: 4,
    marginBottom: 18,
  },
  segment: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: "#fffaf4",
    borderWidth: 1,
    borderColor: "#eadfce",
  },
  segmentText: { fontSize: 14, fontWeight: "600", color: "#6f6258" },
  segmentTextActive: { color: "#201c19" },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#201c19", marginBottom: 10 },
  searchInput: {
    backgroundColor: "#fffaf4",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eadfce",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#201c19",
    marginBottom: 12,
  },
  filterBlock: {
    backgroundColor: "#fffaf4",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 14,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4f4339",
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eadfce",
    backgroundColor: "#f6eee4",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: "#2f5d50",
    borderColor: "#2f5d50",
  },
  filterChipText: {
    fontSize: 12,
    color: "#5f5145",
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
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
  },
  categoryLabel: { fontSize: 18, fontWeight: "700", color: "#201c19" },
  categoryCount: { marginTop: 2, fontSize: 13, color: "#6f6258" },
  categoryArrow: { fontSize: 24, color: "#9d5c2f" },
  previewWrap: { marginTop: 10, opacity: 0.48 },
  emptyPreview: { marginTop: 10, fontSize: 13, color: "#8a7f74" },
  pressed: { opacity: 0.88 },
  previewEventCard: {
    backgroundColor: "#fff6ea",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 12,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  eventTitle: { fontSize: 16, fontWeight: "700", color: "#241f1c", marginBottom: 4 },
  eventMeta: { fontSize: 13, color: "#6f6258" },
  eventDescription: { fontSize: 13, color: "#5f5145", marginBottom: 6, lineHeight: 19 },
  visibilityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  publicBadge: {
    backgroundColor: "#eef3e8",
    borderColor: "#d3ddc8",
  },
  privateBadge: {
    backgroundColor: "#f3eee7",
    borderColor: "#e2d6c6",
  },
  visibilityText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4f4339",
  },
  discoverCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 16,
    marginBottom: 12,
  },
  discoverFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#efe4d7",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  discoverHost: { fontSize: 12, color: "#4e6258", fontWeight: "600" },
  discoverVibe: { fontSize: 12, color: "#6f6258" },
  discoverActionRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#efe4d7",
    alignItems: "flex-start",
  },
  joinButton: {
    backgroundColor: "#2f5d50",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
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
