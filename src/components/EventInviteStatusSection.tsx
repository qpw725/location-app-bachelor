import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { fetchEventInviteStatuses, type EventInviteStatus } from "../data/eventStore";
import { getProfileInitials } from "../profile";
import ProfileAvatar from "./ProfileAvatar";

type Props = {
  eventId: string;
};

const statusLabels: Record<EventInviteStatus["status"], string> = {
  host: "Host",
  accepted: "Accepted",
  declined: "Declined",
  pending: "Awaiting response",
};

function getStatusBadgeStyle(status: EventInviteStatus["status"]) {
  if (status === "host") return styles.hostBadge;
  if (status === "accepted") return styles.acceptedBadge;
  if (status === "declined") return styles.declinedBadge;
  return styles.pendingBadge;
}

function getStatusTextStyle(status: EventInviteStatus["status"]) {
  if (status === "host") return styles.hostBadgeText;
  if (status === "accepted") return styles.acceptedBadgeText;
  if (status === "declined") return styles.declinedBadgeText;
  return styles.pendingBadgeText;
}

export default function EventInviteStatusSection({ eventId }: Props) {
  const [invitees, setInvitees] = useState<EventInviteStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadInvitees() {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await fetchEventInviteStatuses(eventId);
      if (!active) {
        return;
      }
      if (fetchError) {
        setError(fetchError);
        setLoading(false);
        return;
      }
      setInvitees(data ?? []);
      setLoading(false);
    }

    void loadInvitees();

    return () => {
      active = false;
    };
  }, [eventId]);

  return (
    <View style={styles.wrap}>
      {loading ? (
        <View style={styles.stateRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.stateText}>Loading invitees...</Text>
        </View>
      ) : null}
      {!loading && error ? <Text style={styles.errorText}>Could not load invited people.</Text> : null}
      {!loading && !error && invitees.length === 0 ? <Text style={styles.emptyText}>No invited people yet.</Text> : null}
      {!loading && !error && invitees.length > 0 ? (
        <View style={styles.list}>
          {invitees.map((invitee) => (
            <View key={`${invitee.id}:${invitee.status}`} style={styles.card}>
              <View style={styles.personRow}>
                <ProfileAvatar
                  avatarUrl={invitee.avatarUrl}
                  initials={getProfileInitials(invitee.name, invitee.username)}
                  size={46}
                />
                <View style={styles.personTextWrap}>
                  <Text style={styles.name} numberOfLines={1}>
                    {invitee.name}
                  </Text>
                  {invitee.username ? <Text style={styles.username}>@{invitee.username}</Text> : null}
                </View>
              </View>
              <View style={[styles.statusBadge, getStatusBadgeStyle(invitee.status)]}>
                <Text style={[styles.statusText, getStatusTextStyle(invitee.status)]}>
                  {statusLabels[invitee.status]}
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
    marginTop: 4,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stateText: {
    color: "#6f6258",
    fontSize: 12,
  },
  errorText: {
    color: "#a23d3d",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyText: {
    color: "#6f6258",
    fontSize: 12,
  },
  list: {
    gap: 0,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#efe4d7",
    gap: 12,
  },
  personRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  personTextWrap: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: "800",
    color: "#201c19",
  },
  username: {
    color: "#6f6258",
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    minWidth: 98,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  hostBadge: {
    backgroundColor: "#e6eefc",
  },
  acceptedBadge: {
    backgroundColor: "#eef3e8",
  },
  declinedBadge: {
    backgroundColor: "#fff1f1",
  },
  pendingBadge: {
    backgroundColor: "#f6eee4",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  hostBadgeText: {
    color: "#214f9c",
  },
  acceptedBadgeText: {
    color: "#2f5d50",
  },
  declinedBadgeText: {
    color: "#a23d3d",
  },
  pendingBadgeText: {
    color: "#6f6258",
  },
});
