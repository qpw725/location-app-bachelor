import { useState } from "react";
import { ScrollView, View, Text, StyleSheet, Pressable } from "react-native";
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
        <Text style={styles.categoryArrow}>→</Text> {/* Simple arrow, can be replaced with an icon if desired */}
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
          <Text style={styles.sectionTitle}>Discover public events</Text>
          {discoverEvents.map((event) => (
            <DiscoverEventCard key={event.title} {...event} />
          ))}
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
