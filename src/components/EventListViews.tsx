import { Pressable, StyleSheet, Text, View } from "react-native";
import type { EventItem } from "../data/eventStore";

type EventSummaryCardProps = {
  event: EventItem;
  onPress: () => void;
};

export function EventSummaryCard({ event, onPress }: EventSummaryCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.summaryCard, pressed && styles.pressed]}>
      <View style={styles.summaryHeader}>
        <View style={styles.summaryMain}>
          <Text style={styles.summaryTitle} numberOfLines={1}>{event.title}</Text>
          <Text style={styles.summaryLocation}>{event.place}</Text>
        </View>
        <View style={[styles.visibilityBadge, event.visibility === "Public" ? styles.publicBadge : styles.privateBadge]}>
          <Text style={styles.visibilityText}>{event.visibility}</Text>
        </View>
      </View>

      <View style={styles.summaryDivider} />

      <View style={styles.summaryFooter}>
        <Text style={styles.summaryMeta} numberOfLines={1}>Hosted by {event.host}</Text>
        <Text style={styles.summaryGenre} numberOfLines={1}>{event.genre}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    minHeight: 178,
    backgroundColor: "#fffaf4",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 18,
    marginTop: 12,
  },
  pressed: { opacity: 0.88 },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryMain: { flex: 1 },
  summaryTitle: { fontSize: 18, fontWeight: "800", color: "#201c19", marginBottom: 8 },
  summaryLocation: { fontSize: 15, color: "#4f4339", fontWeight: "600", lineHeight: 21 },
  visibilityBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  publicBadge: { backgroundColor: "#eef3e8", borderColor: "#d3ddc8" },
  privateBadge: { backgroundColor: "#f3eee7", borderColor: "#e2d6c6" },
  visibilityText: { fontSize: 11, fontWeight: "800", color: "#4f4339" },
  summaryDivider: {
    height: 1,
    backgroundColor: "#2d2926",
    opacity: 0.18,
    marginTop: 18,
  },
  summaryFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    marginTop: 8,
  },
  summaryMeta: { flex: 1, fontSize: 14, color: "#4f4339", fontWeight: "700" },
  summaryGenre: { maxWidth: "40%", fontSize: 14, color: "#4f4339", fontWeight: "800", textAlign: "right" },
});
