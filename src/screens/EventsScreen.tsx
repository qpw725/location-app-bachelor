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
import { CompositeScreenProps } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../../App";
import { supabase } from "../supabase";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Events">,
  NativeStackScreenProps<RootStackParamList>
>;

type DbEventRow = {
  id: string;
  title: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  genre: string | null;
  private: boolean | null;
  creator_id: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
};

type EventItem = {
  id: string;
  title: string;
  time: string;
  place: string;
  host: string;
  genre: string;
  visibility: "Public" | "Private";
  startAt: Date | null;
  endAt: Date | null;
  creatorId: string | null;
};

type EventRelationConfig = {
  table: string;
  eventIdColumn: string;
  userIdColumn: string;
  statusColumn?: string;
  acceptedStatuses?: string[];
};

const relationTableCandidates: EventRelationConfig[] = [
  {
    table: "event_invites",
    eventIdColumn: "event_id",
    userIdColumn: "invitee_id",
    statusColumn: "status",
    acceptedStatuses: ["accepted", "pending"],
  },
  {
    table: "event_participants",
    eventIdColumn: "event_id",
    userIdColumn: "user_id",
    statusColumn: "status",
    acceptedStatuses: ["accepted", "attending", "invited"],
  },
  {
    table: "event_members",
    eventIdColumn: "event_id",
    userIdColumn: "user_id",
  },
  {
    table: "event_attendees",
    eventIdColumn: "event_id",
    userIdColumn: "user_id",
  },
];

function formatHostName(profile: ProfileRow | undefined, creatorId: string | null, activeUserId: string | null) {
  if (creatorId && activeUserId && creatorId === activeUserId) {
    return "You";
  }
  if (!profile) {
    return "Host";
  }
  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  const fullName = `${first} ${last}`.trim();
  return fullName || profile.username?.trim() || "Host";
}

function formatEventTime(startIso: string | null, endIso: string | null) {
  if (!startIso) {
    return "Time not set";
  }
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const dateLabel = start.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" });
  const startLabel = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (!end) {
    return `${dateLabel} at ${startLabel}`;
  }
  const endLabel = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${dateLabel} ${startLabel} - ${endLabel}`;
}

function mapEventRow(row: DbEventRow, creatorProfile: ProfileRow | undefined, activeUserId: string | null): EventItem {
  return {
    id: row.id,
    title: row.title?.trim() || "Untitled event",
    time: formatEventTime(row.start_time, row.end_time),
    place: row.location?.trim() || "Location not set",
    host: formatHostName(creatorProfile, row.creator_id, activeUserId),
    genre: row.genre?.trim() || "General",
    visibility: row.private ? "Private" : "Public",
    startAt: row.start_time ? new Date(row.start_time) : null,
    endAt: row.end_time ? new Date(row.end_time) : null,
    creatorId: row.creator_id,
  };
}

function MyEventPreviewCard({ title, time, place, host, genre, visibility }: EventItem) {
  return (
    <View style={styles.previewEventCard}>
      <View style={styles.eventHeader}>
        <Text style={styles.eventTitle}>{title}</Text>
        <View style={[styles.visibilityBadge, visibility === "Public" ? styles.publicBadge : styles.privateBadge]}>
          <Text style={styles.visibilityText}>{visibility}</Text>
        </View>
      </View>
      <Text style={styles.eventMeta}>{time}</Text>
      <Text style={styles.eventMeta}>{place}</Text>
      <View style={styles.discoverFooter}>
        <Text style={styles.discoverHost}>{host}</Text>
        <Text style={styles.discoverVibe}>{genre}</Text>
      </View>
    </View>
  );
}

function DiscoverEventCard({ title, time, place, host, genre }: EventItem) {
  return (
    <View style={styles.discoverCard}>
      <Text style={styles.eventTitle}>{title}</Text>
      <Text style={styles.eventMeta}>{time}</Text>
      <Text style={styles.eventMeta}>{place}</Text>
      <View style={styles.discoverFooter}>
        <Text style={styles.discoverHost}>{host}</Text>
        <Text style={styles.discoverVibe}>{genre}</Text>
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
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [publicEvents, setPublicEvents] = useState<EventItem[]>([]);
  const [invitedEvents, setInvitedEvents] = useState<EventItem[]>([]);
  const [hostingEvents, setHostingEvents] = useState<EventItem[]>([]);

  const categoryOptions = useMemo(() => {
    const seeded = ["Relaxed social", "Casual networking", "Games and drinks", "Fitness group"];
    const fromEvents = Array.from(
      new Set(publicEvents.concat(invitedEvents).map((event) => event.genre).filter((genre) => genre.length > 0))
    );
    return Array.from(new Set(seeded.concat(fromEvents)));
  }, [invitedEvents, publicEvents]);

  const loadEvents = useCallback(async () => {
    setEventsError(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      setEventsError(authError.message);
      setLoadingEvents(false);
      return;
    }

    const userId = authData.user?.id ?? null;
    setActiveUserId(userId);

    const { data: publicRows, error: publicError } = await supabase
      .from("events")
      .select("id, title, location, start_time, end_time, genre, private, creator_id")
      .eq("private", false)
      .order("start_time", { ascending: true });

    if (publicError) {
      setEventsError(publicError.message);
      setLoadingEvents(false);
      return;
    }

    const publicEventRows = (publicRows ?? []) as DbEventRow[];
    const invitedEventIds = new Set<string>();

    if (userId) {
      for (const relation of relationTableCandidates) {
        const selectColumns = relation.statusColumn
          ? `${relation.eventIdColumn}, ${relation.statusColumn}`
          : relation.eventIdColumn;

        const { data, error } = await supabase
          .from(relation.table)
          .select(selectColumns)
          .eq(relation.userIdColumn, userId);

        if (error) {
          if (error.code === "42P01" || error.code === "42703") {
            continue;
          }
          setEventsError(error.message);
          setLoadingEvents(false);
          return;
        }

        const rows = ((data ?? []) as unknown) as Record<string, string | null>[];
        for (const row of rows) {
          const eventId = row[relation.eventIdColumn];
          const statusValue = relation.statusColumn ? row[relation.statusColumn] : null;
          if (!eventId) {
            continue;
          }
          if (relation.acceptedStatuses && relation.statusColumn) {
            if (!statusValue || !relation.acceptedStatuses.includes(String(statusValue).toLowerCase())) {
              continue;
            }
          }
          invitedEventIds.add(String(eventId));
        }
      }
    }

    const invitedRows: DbEventRow[] = [];
    if (invitedEventIds.size > 0) {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, location, start_time, end_time, genre, private, creator_id")
        .in("id", Array.from(invitedEventIds))
        .order("start_time", { ascending: true });

      if (error) {
        setEventsError(error.message);
        setLoadingEvents(false);
        return;
      }

      invitedRows.push(...((data ?? []) as DbEventRow[]));
    }

    const myHostingRows: DbEventRow[] = [];
    if (userId) {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, location, start_time, end_time, genre, private, creator_id")
        .eq("creator_id", userId)
        .order("start_time", { ascending: true });

      if (error) {
        setEventsError(error.message);
        setLoadingEvents(false);
        return;
      }

      myHostingRows.push(...((data ?? []) as DbEventRow[]));
    }

    const creatorIds = Array.from(
      new Set(publicEventRows.concat(invitedRows, myHostingRows).map((row) => row.creator_id).filter(Boolean))
    ) as string[];
    const profileMap = new Map<string, ProfileRow>();

    if (creatorIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, first_name, last_name")
        .in("id", creatorIds);

      if (!profilesError) {
        for (const profile of (profiles ?? []) as ProfileRow[]) {
          profileMap.set(profile.id, profile);
        }
      }
    }

    const mappedPublic = publicEventRows.map((row) => mapEventRow(row, profileMap.get(row.creator_id ?? ""), userId));
    const mappedInvited = invitedRows.map((row) => mapEventRow(row, profileMap.get(row.creator_id ?? ""), userId));
    const mappedHosting = myHostingRows.map((row) => mapEventRow(row, profileMap.get(row.creator_id ?? ""), userId));

    setPublicEvents(mappedPublic);
    setInvitedEvents(mappedInvited);
    setHostingEvents(mappedHosting);
    setLoadingEvents(false);
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const pastEvents = useMemo(() => {
    const now = Date.now();
    return invitedEvents
      .concat(hostingEvents)
      .filter((event) => {
        const endTime = event.endAt?.getTime() ?? event.startAt?.getTime();
        return typeof endTime === "number" && endTime < now;
      })
      .sort((a, b) => (b.startAt?.getTime() ?? 0) - (a.startAt?.getTime() ?? 0));
  }, [hostingEvents, invitedEvents]);

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

  const attendingEvents = useMemo(() => {
    const hostedIds = new Set(hostingEvents.map((event) => event.id));
    return invitedEvents.filter((event) => !hostedIds.has(event.id));
  }, [hostingEvents, invitedEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

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
        <Text style={styles.heroEyebrow}>EVENTS</Text>
        <Text style={styles.heroTitle}>Your event timeline</Text>
        <Text style={styles.heroSubtitle}>Invites and public events from your database.</Text>
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
            count={attendingEvents.length}
            preview={attendingEvents[0]}
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
            <DiscoverEventCard key={event.id} {...event} />
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
  container: { flex: 1, backgroundColor: "#f4f6fb" },
  content: { padding: 20, paddingBottom: 28 },
  hero: {
    backgroundColor: "#10264a",
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
  },
  heroEyebrow: {
    color: "#9fb7db",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroTitle: { color: "#ffffff", fontSize: 28, fontWeight: "800", marginBottom: 4 },
  heroSubtitle: { color: "#d7e3f6", fontSize: 14 },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#e8edf7",
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  segment: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8e1f2",
  },
  segmentText: { fontSize: 14, fontWeight: "600", color: "#5d6a80" },
  segmentTextActive: { color: "#1a2233" },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#1a2233", marginBottom: 10 },
  searchInput: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e1f2",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1a2233",
    marginBottom: 12,
  },
  filterBlock: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    padding: 12,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#33415c",
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
    borderColor: "#d8e1f2",
    backgroundColor: "#f7f9fd",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: "#1f4fa3",
    borderColor: "#1f4fa3",
  },
  filterChipText: {
    fontSize: 12,
    color: "#4c5e7b",
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  categoryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    padding: 14,
    marginBottom: 12,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryLabel: { fontSize: 18, fontWeight: "700", color: "#1a2233" },
  categoryCount: { marginTop: 2, fontSize: 13, color: "#5d6a80" },
  categoryArrow: { fontSize: 24, color: "#1a2233" },
  previewWrap: { marginTop: 10, opacity: 0.48 },
  emptyPreview: { marginTop: 10, fontSize: 13, color: "#8a94a5" },
  pressed: { opacity: 0.88 },
  previewEventCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    padding: 12,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  eventTitle: { fontSize: 16, fontWeight: "700", color: "#1a2233", marginBottom: 4 },
  eventMeta: { fontSize: 13, color: "#5d6a80" },
  visibilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  publicBadge: {
    backgroundColor: "#ecf7ee",
    borderColor: "#b9e0bf",
  },
  privateBadge: {
    backgroundColor: "#f3f0ff",
    borderColor: "#d6cdfa",
  },
  visibilityText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#33415c",
  },
  discoverCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    padding: 14,
    marginBottom: 10,
  },
  discoverFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#edf1f8",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  discoverHost: { fontSize: 12, color: "#3f4e68", fontWeight: "600" },
  discoverVibe: { fontSize: 12, color: "#5d6a80" },
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
});
