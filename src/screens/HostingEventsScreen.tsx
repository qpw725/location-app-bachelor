import { ScrollView, View, Text, StyleSheet } from "react-native";
import { hostingEvents, type MyEventItem } from "../data/eventsMock";

function EventCard({ title, time, place, host, genre, visibility }: MyEventItem) {
  return (
    <View style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <Text style={styles.eventTitle}>{title}</Text>
        <View style={[styles.visibilityBadge, visibility === "Public" ? styles.publicBadge : styles.privateBadge]}>
          <Text style={styles.visibilityText}>{visibility}</Text>
        </View>
      </View>
      <Text style={styles.eventMeta}>{time}</Text>
      <Text style={styles.eventMeta}>{place}</Text>
      <View style={styles.metaFooter}>
        <Text style={styles.metaLabel}>{host}</Text>
        <Text style={styles.metaLabel}>{genre}</Text>
      </View>
    </View>
  );
}

export default function HostingEventsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Hosting</Text>
      {hostingEvents.map((event) => (
        <EventCard key={event.title} {...event} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6fb" },
  content: { padding: 20, paddingBottom: 28 },
  sectionTitle: { fontSize: 22, fontWeight: "700", color: "#1a2233", marginBottom: 12 },
  eventCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    padding: 14,
    marginBottom: 10,
  },
  eventHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  eventTitle: { fontSize: 16, fontWeight: "700", color: "#1a2233", marginBottom: 4 },
  eventMeta: { fontSize: 13, color: "#5d6a80" },
  visibilityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  publicBadge: { backgroundColor: "#ecf7ee", borderColor: "#b9e0bf" },
  privateBadge: { backgroundColor: "#f3f0ff", borderColor: "#d6cdfa" },
  visibilityText: { fontSize: 11, fontWeight: "700", color: "#33415c" },
  metaFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#edf1f8",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaLabel: { fontSize: 12, color: "#3f4e68", fontWeight: "600" },
});
