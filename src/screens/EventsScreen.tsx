import { useState, useMemo } from "react";
import { ScrollView, View, Text, StyleSheet, Pressable, TextInput, PanResponder } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../../App";
import {
  attendingEvents,
  discoverEvents,
  hostingEvents,
  pastEvents,
  type DiscoverEventItem,
  type MyEventItem,
} from "../data/eventsMock";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Events">,
  NativeStackScreenProps<RootStackParamList>
>;

function MyEventPreviewCard({ title, time, place, host, genre, visibility }: MyEventItem) {
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

function DiscoverEventCard({ title, time, place, host, vibe }: DiscoverEventItem) {
  return (
    <View style={styles.discoverCard}>
      <Text style={styles.eventTitle}>{title}</Text>
      <Text style={styles.eventMeta}>{time}</Text>
      <Text style={styles.eventMeta}>{place}</Text>
      <View style={styles.discoverFooter}>
        <Text style={styles.discoverHost}>{host}</Text>
        <Text style={styles.discoverVibe}>{vibe}</Text>
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
  preview?: MyEventItem;
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

  const categoryOptions = ["Relaxed social", "Casual networking", "Games and drinks", "Fitness group"];

  const filteredDiscoverEvents = discoverEvents.filter((event) => {
    const query = discoverSearch.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      event.title.toLowerCase().includes(query) ||
      event.place.toLowerCase().includes(query) ||
      event.host.toLowerCase().includes(query) ||
      event.vibe.toLowerCase().includes(query);

    const matchesCategory =
      selectedCategories.length === 0 || selectedCategories.includes(event.vibe);

    const lowerPlace = event.place.toLowerCase();
    const matchesLocation =
      locationFilter === "Any" ||
      (locationFilter === "Nearby" && !lowerPlace.includes("city center")) ||
      (locationFilter === "City Center" && lowerPlace.includes("city center"));

    const lowerTime = event.time.toLowerCase();
    const matchesTime =
      timeFilter === "Any" ||
      (timeFilter === "Today" && lowerTime.includes("today")) ||
      (timeFilter === "This Week" && !lowerTime.includes("today"));

    return matchesSearch && matchesCategory && matchesLocation && matchesTime;
  });

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
    >
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>EVENTS</Text>
        <Text style={styles.heroTitle}>Your event timeline</Text>
        <Text style={styles.heroSubtitle}>All placeholder content for now.</Text>
      </View>

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
          {filteredDiscoverEvents.map((event) => (
            <DiscoverEventCard key={event.title} {...event} />
          ))}
          {filteredDiscoverEvents.length === 0 && (
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
});
