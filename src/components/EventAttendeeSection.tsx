import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { fetchEventAttendees, type EventAttendee } from "../data/eventStore";
import { getProfileInitials } from "../profile";
import ProfileAvatar from "./ProfileAvatar";

type Props = {
  eventId: string;
};

export default function EventAttendeeSection({ eventId }: Props) {
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAttendees() {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await fetchEventAttendees(eventId);
      if (!active) {
        return;
      }
      if (fetchError) {
        setError(fetchError);
        setLoading(false);
        return;
      }
      setAttendees(data ?? []);
      setLoading(false);
    }

    void loadAttendees();

    return () => {
      active = false;
    };
  }, [eventId]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Attendees</Text>
      {loading ? (
        <View style={styles.stateRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.stateText}>Loading attendees...</Text>
        </View>
      ) : null}
      {!loading && error ? <Text style={styles.errorText}>Could not load attendees.</Text> : null}
      {!loading && !error && attendees.length === 0 ? <Text style={styles.emptyText}>No attendees yet.</Text> : null}
      {!loading && !error && attendees.length > 0 ? (
        <View style={styles.list}>
          {attendees.map((attendee) => (
            <View key={attendee.id} style={styles.card}>
              <View style={styles.personRow}>
                <ProfileAvatar
                  avatarUrl={attendee.avatarUrl}
                  initials={getProfileInitials(attendee.name, attendee.username)}
                  size={52}
                />
                <Text style={styles.name} numberOfLines={2}>
                  {attendee.name}
                </Text>
              </View>
              <View style={[styles.statusBadge, attendee.isHost ? styles.hostBadge : styles.attendingBadge]}>
                <Text style={[styles.statusText, attendee.isHost ? styles.hostBadgeText : styles.attendingBadgeText]}>
                  {attendee.isHost ? "Host" : "Attending"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#edf1f8",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1a2233",
    marginBottom: 12,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stateText: {
    color: "#5d6a80",
    fontSize: 12,
  },
  errorText: {
    color: "#a23d3d",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyText: {
    color: "#6b7a90",
    fontSize: 12,
  },
  list: {
    gap: 0,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e4eaf5",
    gap: 12,
  },
  personRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  name: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#1a2233",
  },
  statusBadge: {
    minWidth: 92,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  hostBadge: {
    backgroundColor: "#d9e7ff",
  },
  attendingBadge: {
    backgroundColor: "#e9eef7",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "700",
  },
  hostBadgeText: {
    color: "#214f9c",
  },
  attendingBadgeText: {
    color: "#52627d",
  },
});
