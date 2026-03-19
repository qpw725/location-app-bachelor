import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { fetchEventAttendees, type EventAttendee } from "../data/eventStore";

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
      <Text style={styles.title}>Attending</Text>
      {loading ? (
        <View style={styles.stateRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.stateText}>Loading attendees...</Text>
        </View>
      ) : null}
      {!loading && error ? <Text style={styles.errorText}>Could not load attendees.</Text> : null}
      {!loading && !error && attendees.length === 0 ? (
        <Text style={styles.emptyText}>No attendees yet.</Text>
      ) : null}
      {!loading && !error && attendees.length > 0 ? (
        <View style={styles.list}>
          {attendees.map((attendee) => (
            <View key={attendee.id} style={styles.card}>
              <Text style={styles.name}>{attendee.name}</Text>
              <Text style={styles.meta}>
                @{attendee.username || "unknown"}
                {attendee.isHost ? " · Host" : ""}
              </Text>
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
    fontSize: 13,
    fontWeight: "700",
    color: "#33415c",
    marginBottom: 8,
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
    gap: 8,
  },
  card: {
    backgroundColor: "#f7f9fd",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e1f2",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  name: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a2233",
  },
  meta: {
    fontSize: 12,
    color: "#5d6a80",
    marginTop: 2,
  },
});
