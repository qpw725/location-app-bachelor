import { Pressable, StyleSheet, Text, View } from "react-native";
import type { EventRuntimeSeverity, EventRuntimeStatus } from "../data/eventRules";
import type { EventItem } from "../data/eventStore";

type EventSummaryCardProps = {
  event: EventItem;
  runtimeStatus?: EventRuntimeStatus | null;
  onPress: () => void;
};

export function EventSummaryCard({ event, runtimeStatus, onPress }: EventSummaryCardProps) {
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

      {event.attendanceEnabled ? (
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, getRuntimeStatusBadgeStyle(runtimeStatus?.severity)]}>
            <Text style={[styles.statusText, getRuntimeStatusTextStyle(runtimeStatus?.severity)]}>
              {getRuntimeStatusLabel(runtimeStatus)}
            </Text>
          </View>
          {runtimeStatus?.canShowLiveState ? (
            <Text style={styles.statusMeta} numberOfLines={1}>
              {runtimeStatus.presentCount} present
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.summaryFooter}>
        <Text style={styles.summaryMeta} numberOfLines={1}>Hosted by {event.host}</Text>
        <Text style={styles.summaryGenre} numberOfLines={1}>{event.genre}</Text>
      </View>
    </Pressable>
  );
}

function getRuntimeStatusLabel(status: EventRuntimeStatus | null | undefined) {
  if (!status) {
    return "Behavior configured";
  }

  if (status.status === "hidden") return "Updates near start";
  if (status.status === "not_started") return "Not started";
  if (status.status === "host_not_arrived") return "Host not arrived";
  if (status.status === "host_left") return "Host left";
  if (status.status === "not_enough_participants") return "Needs participants";
  if (status.status === "event_full") return "Full";
  if (status.status === "ready") return "Ready";
  if (status.status === "active") return "Active";
  if (status.status === "ended") return "Ended";

  return "Event status";
}

function getRuntimeStatusBadgeStyle(severity: EventRuntimeSeverity | undefined) {
  if (severity === "danger") return styles.statusBadgeDanger;
  if (severity === "warning") return styles.statusBadgeWarning;
  if (severity === "success") return styles.statusBadgeSuccess;
  return styles.statusBadgeNeutral;
}

function getRuntimeStatusTextStyle(severity: EventRuntimeSeverity | undefined) {
  if (severity === "danger") return styles.statusTextDanger;
  if (severity === "warning") return styles.statusTextWarning;
  if (severity === "success") return styles.statusTextSuccess;
  return styles.statusTextNeutral;
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
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 10,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeNeutral: {
    backgroundColor: "#f3eee7",
  },
  statusBadgeWarning: {
    backgroundColor: "#fff6ea",
  },
  statusBadgeSuccess: {
    backgroundColor: "#edf4ee",
  },
  statusBadgeDanger: {
    backgroundColor: "#fff1f1",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "900",
  },
  statusTextNeutral: {
    color: "#6f6258",
  },
  statusTextWarning: {
    color: "#8a5a12",
  },
  statusTextSuccess: {
    color: "#2f5d50",
  },
  statusTextDanger: {
    color: "#a23d3d",
  },
  statusMeta: {
    flex: 1,
    color: "#6f6258",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
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
