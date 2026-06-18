import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Calendar from "expo-calendar";
import type { RootStackParamList } from "../../../App";
import EventInviteStatusSection from "../../components/EventInviteStatusSection";
import ProfileAvatar from "../../components/ProfileAvatar";
import {
  fetchEventRuntimeStatus,
  type EventPresencePerson,
  type EventRuntimeSeverity,
  type EventRuntimeStatus,
} from "../../data/eventRules";
import { deleteHostedEvent, fetchEventBuckets, leaveEvent, type EventItem } from "../../data/eventStore";
import { getProfileInitials } from "../../profile";
import { supabase } from "../../supabase";
import { commonStyles } from "../../styles/common";

type Props = NativeStackScreenProps<RootStackParamList, "EventDetails">;

export default function EventDetailsScreen({ navigation, route }: Props) {
  const { eventId, source } = route.params;
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<EventRuntimeStatus | null>(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  // Load all event buckets, then pick the bucket this screen was opened from.
  const loadEvent = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await fetchEventBuckets();

    if (fetchError || !data) {
      setError(fetchError ?? "Could not load event details.");
      setLoading(false);
      return;
    }

    let sourceEvents;
    if (source === "attending") {
      sourceEvents = data.attendingEvents;
    } else if (source === "hosting") {
      sourceEvents = data.hostingEvents;
    } else {
      sourceEvents = data.pastEvents;
    }

    // Route params only give us the id, so find the full event object in that bucket.
    const matchingEvent = sourceEvents.find((item) => item.id === eventId) ?? null;

    setEvent(matchingEvent);
    setError(matchingEvent ? null : "This event could not be found.");
    setLoading(false);
  }, [eventId, source]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  // Runtime status is separate from the event details because it depends on live attendance/location data.
  const loadRuntimeStatus = useCallback(async () => {
    if (!event?.attendanceEnabled) {
      setRuntimeStatus(null);
      setRuntimeError(null);
      return;
    }

    setRuntimeLoading(true);
    const { data, error: runtimeFetchError } = await fetchEventRuntimeStatus({
      event,
      viewerRole: source,
    });
    setRuntimeStatus(data);
    setRuntimeError(runtimeFetchError);
    setRuntimeLoading(false);
  }, [event, source]);

  useEffect(() => {
    if (!event?.attendanceEnabled) {
      setRuntimeStatus(null);
      setRuntimeError(null);
      return;
    }

    void loadRuntimeStatus();
  }, [event, loadRuntimeStatus]);

  // Keep the status card and attendance overview updated while this screen is open.
  useEffect(() => {
    if (!event?.attendanceEnabled) {
      return;
    }

    const attendanceChannel = supabase
      .channel(`event-attendance:${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_attendance",
          filter: `event_id=eq.${event.id}`,
        },
        () => {
          void loadRuntimeStatus();
        }
      )
      .subscribe();

    const inviteChannel = supabase
      .channel(`event-invites:${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_invites",
          filter: `event_id=eq.${event.id}`,
        },
        () => {
          void loadRuntimeStatus();
        }
      )
      .subscribe();

    const liveLocationChannel = supabase
      .channel(`event-live-locations-status:${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_live_locations",
          filter: `event_id=eq.${event.id}`,
        },
        () => {
          void loadRuntimeStatus();
        }
      )
      .subscribe();

    const refreshHandle = setInterval(() => {
      void loadRuntimeStatus();
    }, 15000);

    // Clean up Supabase subscriptions and polling when the event changes or the screen unmounts.
    return () => {
      clearInterval(refreshHandle);
      void supabase.removeChannel(attendanceChannel);
      void supabase.removeChannel(inviteChannel);
      void supabase.removeChannel(liveLocationChannel);
    };
  }, [event, loadRuntimeStatus]);

  function openMap() {
    if (!event) {
      return;
    }

    navigation.navigate("LiveEventMap", { eventId: event.id, eventTitle: event.title });
  }

  async function addToCalendar() {
    if (!event?.startAt || !event.endAt) {
      Alert.alert("Calendar unavailable", "This event is missing a start or end time.");
      return;
    }

    const isAvailable = await Calendar.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert("Calendar unavailable", "This device does not support calendar access.");
      return;
    }

    const permission = await Calendar.requestCalendarPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Calendar permission needed", "Calendar access is needed to add this event.");
      return;
    }

    await Calendar.createEventInCalendarAsync({
      title: event.title,
      startDate: event.startAt,
      endDate: event.endAt,
      notes: event.description,
      location: event.place,
    });
  }

  function confirmLeaveEvent() {
    if (!event) {
      return;
    }

    Alert.alert("Leave event?", `Remove yourself from "${event.title}"?`, [
      { text: "Stay", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => void handleLeaveEvent() },
    ]);
  }

  async function handleLeaveEvent() {
    if (!event) {
      return;
    }

    setProcessingAction(true);
    const { error: leaveError } = await leaveEvent(event.id);
    setProcessingAction(false);

    if (leaveError) {
      setError(leaveError);
      return;
    }

    navigation.goBack();
  }

  function confirmDeleteEvent() {
    if (!event) {
      return;
    }

    Alert.alert("Delete event?", `Delete "${event.title}" for everyone? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void handleDeleteEvent() },
    ]);
  }

  async function handleDeleteEvent() {
    if (!event) {
      return;
    }

    setProcessingAction(true);
    const { error: deleteError } = await deleteHostedEvent(event.id);
    setProcessingAction(false);

    if (deleteError) {
      setError(deleteError);
      return;
    }

    navigation.goBack();
  }

  return (
    <ScrollView style={commonStyles.screen} contentContainerStyle={commonStyles.scrollContent}>
      {loading ? (
        <View style={commonStyles.stateCard}>
          <ActivityIndicator size="small" />
          <Text style={commonStyles.stateText}>Loading event details...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={commonStyles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {event ? (
        <>
          {event.attendanceEnabled ? (
            <View style={[styles.eventStatusCard, getStatusCardStyle(runtimeStatus?.severity)]}>
              <View style={styles.eventStatusHeader}>
                <View style={styles.liveDot} />
                <Text style={styles.eventStatusLabel}>Event status</Text>
              </View>
              <Text style={styles.eventStatusTitle}>
                {runtimeLoading && !runtimeStatus ? "Loading event status..." : runtimeStatus?.title ?? "Event status unavailable"}
              </Text>
              {runtimeStatus ? <Text style={styles.eventStatusMessage}>{runtimeStatus.message}</Text> : null}
              <View style={styles.statusPillRow}>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>{getPresenceMethodLabel(event)}</Text>
                </View>
                {runtimeStatus?.canShowLiveState ? (
                  <>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>{runtimeStatus.presentCount} present</Text>
                    </View>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>{runtimeStatus.hostPresent ? "Host present" : "Host missing"}</Text>
                    </View>
                    {runtimeStatus.minimumPresentCount ? (
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>Need {runtimeStatus.minimumPresentCount}</Text>
                      </View>
                    ) : null}
                    {runtimeStatus.capacityLimit ? (
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>Cap {runtimeStatus.capacityLimit}</Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>Updates near start</Text>
                  </View>
                )}
              </View>
              {runtimeError ? <Text style={styles.liveAttendanceStatus}>{runtimeError}</Text> : null}
            </View>
          ) : null}

          {event.attendanceEnabled && runtimeStatus?.canShowLiveState ? (
            <View style={commonStyles.card}>
              <Text style={styles.sectionTitle}>Your presence</Text>
              <PersonalPresenceCard presence={runtimeStatus.viewerPresence} eventEnded={runtimeStatus.status === "ended"} />
            </View>
          ) : null}

          <View style={styles.hero}>
            <View style={styles.heroHeader}>
              <Text style={styles.heroTitle}>{event.title}</Text>
              <View style={[styles.visibilityBadge, event.visibility === "Public" ? styles.publicBadge : styles.privateBadge]}>
                <Text style={styles.visibilityText}>{event.visibility}</Text>
              </View>
            </View>
            <Text style={styles.heroSubtitle}>{event.description}</Text>
            <View style={styles.heroActionRow}>
              <Pressable style={styles.calendarButton} onPress={() => void addToCalendar()} disabled={processingAction}>
                <Text style={styles.calendarButtonText}>Add to calendar</Text>
              </Pressable>

              {source !== "past" && event.liveMapEnabled ? (
                <Pressable style={styles.primaryButton} onPress={openMap} disabled={processingAction}>
                  <Text style={styles.primaryButtonText}>Map</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={commonStyles.card}>
            <InfoRow label="When" value={event.time} />
            <InfoRow label="Location" value={event.place} />
            <InfoRow label="Hosted by" value={event.host} />
            <InfoRow label="Genre" value={event.genre} />
          </View>

          {source === "hosting" && event.attendanceEnabled && runtimeStatus?.canShowLiveState ? (
            <View style={commonStyles.card}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitleNoMargin}>Attendance</Text>
                <Text style={styles.sectionCount}>{runtimeStatus.presentCount}/{runtimeStatus.acceptedCount} present</Text>
              </View>
              <AttendanceOverview status={runtimeStatus} eventStartAt={event.startAt} eventEndAt={event.endAt} />
            </View>
          ) : null}

          <View style={commonStyles.card}>
            <Text style={styles.sectionTitle}>Invited people</Text>
            <EventInviteStatusSection eventId={event.id} />
          </View>

          {source === "attending" ? (
            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryButton} onPress={confirmLeaveEvent} disabled={processingAction}>
                <Text style={styles.secondaryButtonText}>{processingAction ? "Leaving..." : "Leave event"}</Text>
              </Pressable>
            </View>
          ) : null}

          {source === "hosting" ? (
            <View style={styles.bottomDangerWrap}>
              <Pressable style={styles.dangerButton} onPress={confirmDeleteEvent} disabled={processingAction}>
                <Text style={styles.dangerButtonText}>{processingAction ? "Deleting..." : "Delete event"}</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function PersonalPresenceCard({ presence, eventEnded }: { presence: EventPresencePerson | null; eventEnded: boolean }) {
  const model = getPersonalPresenceModel(presence, eventEnded);

  return (
    <View style={[styles.personalPresenceCard, model.tone === "success" && styles.personalPresenceSuccess, model.tone === "warning" && styles.personalPresenceWarning]}>
      <View style={styles.personalPresenceHeader}>
        <View style={[styles.personalPresenceDot, model.tone === "warning" && styles.personalPresenceDotWarning]} />
        <Text style={styles.personalPresenceTitle}>{model.title}</Text>
      </View>
      <Text style={styles.personalPresenceText}>{model.message}</Text>
      {presence?.distanceMeters !== null && presence?.distanceMeters !== undefined ? (
        <Text style={styles.personalPresenceMeta}>{Math.round(presence.distanceMeters)} m from the event location</Text>
      ) : null}
    </View>
  );
}

type AttendanceFilter = "present" | "arrived" | "missing" | "left";

function AttendanceOverview({
  status,
  eventStartAt,
  eventEndAt,
}: {
  status: EventRuntimeStatus;
  eventStartAt: Date | null;
  eventEndAt: Date | null;
}) {
  const [selectedFilter, setSelectedFilter] = useState<AttendanceFilter>("present");
  const arrivedCount = status.participants.filter((participant) => participant.hasCheckedIn).length;
  const leftCount = status.participants.filter((participant) => participant.presenceState === "left").length;
  const notArrivedCount = status.participants.filter(
    (participant) => participant.presenceState === "not_arrived" || participant.presenceState === "inactive"
  ).length;

  // Each metric doubles as a filter button and as the source list for the rows below it.
  const metrics = useMemo(
    () => [
      {
        filter: "present" as const,
        label: "Present now",
        value: String(status.presentCount),
        people: status.participants.filter((participant) => participant.presenceState === "present"),
      },
      {
        filter: "arrived" as const,
        label: "Arrived",
        value: String(arrivedCount),
        people: status.participants.filter((participant) => participant.hasCheckedIn),
      },
      {
        filter: "missing" as const,
        label: "Missing",
        value: String(notArrivedCount),
        people: status.participants.filter(
          (participant) => participant.presenceState === "not_arrived" || participant.presenceState === "inactive"
        ),
      },
      {
        filter: "left" as const,
        label: "Left",
        value: String(leftCount),
        people: status.participants.filter((participant) => participant.presenceState === "left"),
      },
    ],
    [arrivedCount, leftCount, notArrivedCount, status.participants, status.presentCount]
  );
  const selectedMetric = metrics.find((metric) => metric.filter === selectedFilter) ?? metrics[0];

  if (status.participants.length === 0) {
    return <Text style={styles.emptyText}>No accepted participants yet.</Text>;
  }

  return (
    <View>
      <View style={styles.attendanceMetricGrid}>
        {metrics.map((metric) => (
          <AttendanceMetric
            key={metric.filter}
            label={metric.label}
            value={metric.value}
            selected={selectedFilter === metric.filter}
            onPress={() => setSelectedFilter(metric.filter)}
          />
        ))}
      </View>

      <Text style={styles.attendanceListTitle}>{selectedMetric.label}</Text>
      <View style={styles.attendanceList}>
        {selectedMetric.people.length === 0 ? (
          <Text style={styles.attendanceEmptyText}>{getAttendanceEmptyText(selectedFilter)}</Text>
        ) : (
          selectedMetric.people.map((participant) => (
            <AttendanceParticipantRow
              key={participant.id}
              participant={participant}
              filter={selectedFilter}
              eventStartAt={eventStartAt}
              eventEndAt={eventEndAt}
            />
          ))
        )}
      </View>
    </View>
  );
}

function AttendanceMetric({ label, value, selected, onPress }: { label: string; value: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.attendanceMetric, selected && styles.attendanceMetricActive, pressed && commonStyles.pressed]}>
      <Text style={styles.attendanceMetricValue}>{value}</Text>
      <Text style={styles.attendanceMetricLabel}>{label}</Text>
    </Pressable>
  );
}

function AttendanceParticipantRow({
  participant,
  filter,
  eventStartAt,
  eventEndAt,
}: {
  participant: EventPresencePerson;
  filter: AttendanceFilter;
  eventStartAt: Date | null;
  eventEndAt: Date | null;
}) {
  const model = getAttendanceStatusModel(participant);
  const timingLines = getAttendanceTimingLines(participant, filter, eventStartAt, eventEndAt);

  return (
    <View style={styles.attendanceRow}>
      <ProfileAvatar
        avatarUrl={participant.avatarUrl}
        initials={getProfileInitials(participant.name, participant.username)}
        size={42}
      />
      <View style={styles.attendanceTextWrap}>
        <View style={styles.attendanceNameRow}>
          <Text style={styles.attendanceName} numberOfLines={1}>{participant.name}</Text>
          <View style={[styles.attendanceStatusBadge, model.tone === "success" && styles.attendanceStatusSuccess, model.tone === "danger" && styles.attendanceStatusDanger]}>
            <Text style={[styles.attendanceStatusText, model.tone === "success" && styles.attendanceStatusTextSuccess, model.tone === "danger" && styles.attendanceStatusTextDanger]}>
              {model.label}
            </Text>
          </View>
        </View>
        {participant.username ? <Text style={styles.attendanceUsername}>@{participant.username}</Text> : null}
        {timingLines.map((line) => (
          <Text key={line} style={styles.attendanceTiming}>{line}</Text>
        ))}
      </View>
    </View>
  );
}

function getAttendanceEmptyText(filter: AttendanceFilter) {
  if (filter === "present") return "No participants are currently present.";
  if (filter === "arrived") return "No participants have arrived yet.";
  if (filter === "missing") return "No participants are missing right now.";
  return "No participants have left the event area.";
}

function getAttendanceStatusModel(participant: EventPresencePerson) {
  // Convert the raw presence state into the label/tone used by attendance rows.
  if (participant.presenceState === "present") {
    return { label: "Present", tone: "success" as const };
  }

  if (participant.presenceState === "left") {
    return { label: "Left", tone: "warning" as const };
  }

  if (participant.presenceState === "inactive") {
    return { label: "Inactive", tone: "warning" as const };
  }

  return { label: "Missing", tone: "danger" as const };
}

function getAttendanceTimingLines(
  participant: EventPresencePerson,
  filter: AttendanceFilter,
  eventStartAt: Date | null,
  eventEndAt: Date | null
) {
  const lines: string[] = [];

  // Show timing details that are useful for the currently selected attendance filter.
  if (filter === "present") {
    lines.push(participant.checkedInAt ? `Arrived at ${formatShortTime(new Date(participant.checkedInAt))}` : "Arrival time not recorded");
    return lines;
  }

  if (filter === "arrived") {
    lines.push(participant.checkedInAt ? `Arrived at ${formatShortTime(new Date(participant.checkedInAt))}` : "Arrival time not recorded");
    lines.push(participant.checkedOutAt ? `Left at ${formatShortTime(new Date(participant.checkedOutAt))}` : "Still present");
    return lines;
  }

  if (filter === "missing") {
    if (participant.presenceState === "inactive" || !participant.lastLocationAt) {
      lines.push("GPS inactive");
    } else if (participant.distanceMeters !== null) {
      lines.push(`${Math.round(participant.distanceMeters)} m from event when last updated`);
    } else {
      lines.push("Distance from event unavailable");
    }
    return lines;
  }

  if (filter === "left") {
    lines.push(participant.checkedInAt ? `Arrived at ${formatShortTime(new Date(participant.checkedInAt))}` : "Arrival time not recorded");
    lines.push(participant.checkedOutAt ? `Left at ${formatShortTime(new Date(participant.checkedOutAt))}${isBeforeEventEnd(new Date(participant.checkedOutAt), eventEndAt) ? " - before end" : ""}` : "Left time not recorded");
  }

  return lines;
}

function getLateMinutes(arrivedAt: Date, eventStartAt: Date | null) {
  if (!eventStartAt) {
    return 0;
  }

  const diffMs = arrivedAt.getTime() - eventStartAt.getTime();
  if (diffMs <= 60 * 1000) {
    return 0;
  }

  return Math.round(diffMs / 60000);
}

function isBeforeEventEnd(leftAt: Date, eventEndAt: Date | null) {
  return Boolean(eventEndAt && leftAt.getTime() < eventEndAt.getTime());
}

function formatShortTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getPersonalPresenceModel(presence: EventPresencePerson | null, eventEnded: boolean) {
  if (!presence) {
    return {
      tone: "warning" as const,
      title: "Not connected to this event",
      message: "Your account is not currently listed as host or accepted participant.",
    };
  }

  if (presence.presenceState === "present") {
    return {
      tone: "success" as const,
      title: eventEnded ? "You were present" : "You are present",
      message: eventEnded
        ? "You were marked present for this event."
        : presence.isHost
          ? "Your host presence can activate the event."
          : "You are currently inside the event area.",
    };
  }

  if (presence.presenceState === "not_arrived") {
    return {
      tone: "warning" as const,
      title: eventEnded ? "You were not marked present" : "You are not present yet",
      message: eventEnded
        ? "No GPS check-in was recorded for you before the event ended."
        : "Keep the app open near the event area so your presence can update.",
    };
  }

  if (presence.presenceState === "left") {
    return {
      tone: "warning" as const,
      title: "You left the event area",
      message: eventEnded
        ? "You were checked in, but your latest event location was outside the configured radius."
        : "Your latest location is outside the configured event radius.",
    };
  }

  return {
    tone: "warning" as const,
    title: eventEnded ? "Location was inactive" : "Location inactive",
    message: eventEnded
      ? "Your last event location update became inactive before the event ended."
      : "Your event location is inactive. Keep the app open to refresh your presence.",
  };
}

function getPresenceMethodLabel(event: EventItem) {
  if (event.attendanceMethod === "gps_geofence") {
    return "GPS area";
  }

  return "Presence rule";
}

function getStatusCardStyle(severity: EventRuntimeSeverity | undefined) {
  // Severity is a UI tone for the current runtime status, not the status logic itself.
  if (severity === "danger") {
    return styles.eventStatusDanger;
  }

  if (severity === "warning") {
    return styles.eventStatusWarning;
  }

  if (severity === "success") {
    return styles.eventStatusSuccess;
  }

  return styles.eventStatusNeutral;
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: "#fffaf4",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    shadowColor: "#7a5c3d",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
    marginBottom: 14,
  },
  heroHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  heroTitle: { flex: 1, color: "#1f1a17", fontSize: 28, fontWeight: "800" },
  heroSubtitle: { color: "#67594d", fontSize: 15, lineHeight: 22 },
  heroActionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  eventStatusCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  eventStatusNeutral: {
    backgroundColor: "#f3eee7",
    borderColor: "#e2d6c6",
  },
  eventStatusWarning: {
    backgroundColor: "#fff6ea",
    borderColor: "#ead1a3",
  },
  eventStatusSuccess: {
    backgroundColor: "#edf4ee",
    borderColor: "#cfe0d2",
  },
  eventStatusDanger: {
    backgroundColor: "#fff4f1",
    borderColor: "#f0c6c0",
  },
  eventStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2f5d50",
  },
  eventStatusLabel: {
    color: "#2f5d50",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  eventStatusTitle: {
    color: "#173d33",
    fontSize: 24,
    fontWeight: "900",
  },
  eventStatusMessage: {
    color: "#36574b",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: 5,
  },
  statusPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  statusPill: {
    borderWidth: 1,
    borderColor: "#c9dacd",
    borderRadius: 999,
    backgroundColor: "#fffaf4",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    color: "#36574b",
    fontSize: 11,
    fontWeight: "800",
  },
  liveAttendanceStatus: {
    color: "#36574b",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#201c19", marginBottom: 10 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  sectionTitleNoMargin: { fontSize: 18, fontWeight: "800", color: "#201c19" },
  sectionCount: { color: "#2f5d50", fontSize: 13, fontWeight: "900" },
  attendanceMetricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  attendanceMetric: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eadfce",
    backgroundColor: "#fff6ea",
    padding: 12,
  },
  attendanceMetricActive: {
    borderColor: "#2f5d50",
    backgroundColor: "#edf4ee",
  },
  attendanceMetricValue: {
    color: "#201c19",
    fontSize: 22,
    fontWeight: "900",
  },
  attendanceMetricLabel: {
    color: "#6f6258",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    textTransform: "uppercase",
  },
  attendanceList: {
    borderTopWidth: 1,
    borderTopColor: "#efe4d7",
  },
  attendanceListTitle: {
    color: "#201c19",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 8,
  },
  attendanceEmptyText: {
    color: "#6f6258",
    fontSize: 13,
    lineHeight: 19,
    paddingTop: 10,
  },
  attendanceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#efe4d7",
  },
  attendanceTextWrap: {
    flex: 1,
  },
  attendanceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  attendanceName: {
    flex: 1,
    color: "#201c19",
    fontSize: 15,
    fontWeight: "800",
  },
  attendanceUsername: {
    color: "#6f6258",
    fontSize: 12,
    marginTop: 2,
  },
  attendanceStatusBadge: {
    borderRadius: 999,
    backgroundColor: "#fff6ea",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  attendanceStatusSuccess: {
    backgroundColor: "#edf4ee",
  },
  attendanceStatusDanger: {
    backgroundColor: "#fff1f1",
  },
  attendanceStatusText: {
    color: "#8a5a12",
    fontSize: 10,
    fontWeight: "900",
  },
  attendanceStatusTextSuccess: {
    color: "#2f5d50",
  },
  attendanceStatusTextDanger: {
    color: "#a23d3d",
  },
  attendanceTiming: {
    color: "#8a7f74",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  personalPresenceCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eadfce",
    backgroundColor: "#fff6ea",
    padding: 14,
  },
  personalPresenceSuccess: {
    borderColor: "#cfe0d2",
    backgroundColor: "#edf4ee",
  },
  personalPresenceWarning: {
    borderColor: "#ead1a3",
    backgroundColor: "#fff6ea",
  },
  personalPresenceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  personalPresenceDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#2f5d50",
  },
  personalPresenceDotWarning: {
    backgroundColor: "#c97a15",
  },
  personalPresenceTitle: {
    color: "#201c19",
    fontSize: 16,
    fontWeight: "900",
  },
  personalPresenceText: {
    color: "#5f5145",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  personalPresenceMeta: {
    color: "#6f6258",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
  },
  emptyText: { color: "#6f6258", fontSize: 13, lineHeight: 19 },
  infoRow: { paddingVertical: 8 },
  infoLabel: { fontSize: 12, color: "#6f6258", fontWeight: "800", textTransform: "uppercase" },
  infoValue: { marginTop: 4, fontSize: 15, color: "#201c19", fontWeight: "600", lineHeight: 20 },
  visibilityBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  publicBadge: { backgroundColor: "#eef3e8", borderColor: "#d3ddc8" },
  privateBadge: { backgroundColor: "#f3eee7", borderColor: "#e2d6c6" },
  visibilityText: { fontSize: 11, fontWeight: "800", color: "#4f4339" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  bottomDangerWrap: {
    alignItems: "center",
    marginTop: 22,
  },
  calendarButton: {
    backgroundColor: "#2f5d50",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  calendarButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  primaryButton: {
    backgroundColor: "#f6eee4",
    borderColor: "#eadfce",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonText: { color: "#4f4339", fontSize: 13, fontWeight: "800" },
  secondaryButton: {
    backgroundColor: "#f6eee4",
    borderColor: "#eadfce",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: { color: "#4f4339", fontSize: 13, fontWeight: "800" },
  dangerButton: {
    backgroundColor: "#fff1f1",
    borderColor: "#efc7c7",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dangerButtonText: { color: "#a23d3d", fontSize: 13, fontWeight: "800" },
  errorText: { color: "#a23d3d", fontSize: 13, fontWeight: "600" },
});
