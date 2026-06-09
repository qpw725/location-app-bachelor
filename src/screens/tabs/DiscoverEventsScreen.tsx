import { useState, useMemo, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import * as Location from "expo-location";
import Slider from "@react-native-community/slider";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import type { MainTabParamList } from "../../../App";
import EventAttendeeSection from "../../components/EventAttendeeSection";
import { fetchEventBuckets, joinPublicEvent, type EventItem } from "../../data/eventStore";
import { colors, commonStyles } from "../../styles/common";

type Props = BottomTabScreenProps<MainTabParamList, "DiscoverEvents">;

const MAX_DISTANCE_KM = 160;

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function PublicEventCard({
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
    <View style={commonStyles.card}>
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

export default function DiscoverEventsScreen(_props: Props) {
  const [discoverSearch, setDiscoverSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [timeFilter, setTimeFilter] = useState<"Any" | "Today" | "This Week">("Any");
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [publicEvents, setPublicEvents] = useState<EventItem[]>([]);
  const [invitedEvents, setInvitedEvents] = useState<EventItem[]>([]);
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationFilterMessage, setLocationFilterMessage] = useState<string | null>(null);
  const [distanceFilterKm, setDistanceFilterKm] = useState(MAX_DISTANCE_KM);

  const loadUserLocation = useCallback(async (promptIfNeeded = false) => {
    try {
      let permission = await Location.getForegroundPermissionsAsync();

      if (!permission.granted && promptIfNeeded) {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (!permission.granted) {
        setUserLocation(null);
        setLocationFilterMessage("Location permission is needed to use the Nearby filter.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setLocationFilterMessage(null);
    } catch {
      setUserLocation(null);
      setLocationFilterMessage("Could not determine your location for the Nearby filter.");
    }
  }, []);

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

    const matchesLocation =
      !userLocation ||
      (
        !!userLocation &&
        typeof event.latitude === "number" &&
        typeof event.longitude === "number" &&
        getDistanceKm(userLocation.latitude, userLocation.longitude, event.latitude, event.longitude) <= distanceFilterKm
      );

    const now = new Date();
    const start = event.startAt;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(todayStart.getDate() + 7);
    const matchesTime =
      timeFilter === "Any" ||
      (timeFilter === "Today" &&
        !!start &&
        start >= todayStart &&
        start < tomorrowStart) ||
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

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <View style={commonStyles.heroCard}>
        <Text style={commonStyles.heroEyebrow}>Discover</Text>
        <Text style={commonStyles.heroTitle}>Find public events</Text>
        <Text style={commonStyles.heroSubtitle}>Search nearby plans, filter by mood, and join the ones that fit your day.</Text>
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

        <View style={styles.distanceSection}>
          <View style={styles.distanceHeader}>
            <Text style={styles.filterLabel}>Distance</Text>
            <Text style={styles.distanceValue}>{distanceFilterKm} km</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={MAX_DISTANCE_KM}
            step={1}
            value={distanceFilterKm}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.borderSoft}
            thumbTintColor={colors.primary}
            onSlidingStart={() => {
              if (!userLocation) {
                void loadUserLocation(true);
              }
            }}
            onValueChange={(value) => {
              setDistanceFilterKm(Math.round(value));
            }}
          />
          <View style={styles.distanceScale}>
            <Text style={styles.distanceScaleText}>0 km</Text>
            <Text style={styles.distanceScaleText}>{MAX_DISTANCE_KM} km</Text>
          </View>
        </View>
        {locationFilterMessage ? <Text style={styles.filterHelpText}>{locationFilterMessage}</Text> : null}

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

      <Text style={commonStyles.sectionTitle}>Public events</Text>
      {discoverList.map((event) => (
        <PublicEventCard
          key={event.id}
          {...event}
          joining={joiningEventId === event.id}
          onJoin={() => {
            void handleJoinEvent(event.id);
          }}
        />
      ))}
      {discoverList.length === 0 && (
        <View style={commonStyles.card}>
          <Text style={styles.eventTitle}>No events match your filters</Text>
          <Text style={styles.eventMeta}>Try changing search text or filters.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
  },
  filterBlock: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4f4339",
    marginBottom: 4,
  },
  distanceSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  distanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: -4,
  },
  distanceValue: {
    fontSize: 13,
    color: "#4f4339",
    fontWeight: "700",
  },
  slider: {
    height: 36,
    marginHorizontal: 0,
    marginBottom: 2,
  },
  distanceScale: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  distanceScaleText: {
    fontSize: 12,
    color: "#8a7f74",
    fontWeight: "600",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  filterHelpText: {
    marginTop: -2,
    marginBottom: 12,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: "#5f5145",
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  eventTitle: { fontSize: 16, fontWeight: "700", color: "#241f1c", marginBottom: 4 },
  eventMeta: { fontSize: 13, color: colors.textMuted },
  eventDescription: { fontSize: 13, color: "#5f5145", marginBottom: 6, lineHeight: 19 },
  discoverFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  discoverHost: { fontSize: 12, color: "#4e6258", fontWeight: "600" },
  discoverVibe: { fontSize: 12, color: colors.textMuted },
  discoverActionRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    alignItems: "flex-start",
  },
  joinButton: {
    backgroundColor: colors.primary,
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
  errorText: { color: "#a23d3d", fontSize: 13, fontWeight: "600" },
});
