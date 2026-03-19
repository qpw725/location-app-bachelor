import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import MapView, { Marker, Region } from "react-native-maps";
import type { RootStackParamList } from "../../App";
import {
  fetchEventLiveParticipants,
  fetchEventMapDetails,
  hasEventMapCoordinates,
  isEventShareWindowOpen,
  type EventMapDetails,
  type LiveEventParticipant,
} from "../data/eventLiveLocation";
import { startEventLocationSharing, stopEventLocationSharing } from "../locationSharingManager";
import { supabase } from "../supabase";

type Props = NativeStackScreenProps<RootStackParamList, "EventMap">;

const DEFAULT_REGION: Region = {
  latitude: 55.6761,
  longitude: 12.5683,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function EventMapScreen({ route }: Props) {
  const { eventId, eventTitle } = route.params;
  const [eventDetails, setEventDetails] = useState<EventMapDetails | null>(null);
  const [participants, setParticipants] = useState<LiveEventParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isBusySharing, setIsBusySharing] = useState(false);

  const loadMap = useCallback(async () => {
    setError(null);

    const [detailsResult, participantsResult] = await Promise.all([
      fetchEventMapDetails(eventId),
      fetchEventLiveParticipants(eventId),
    ]);

    if (detailsResult.error || !detailsResult.data) {
      setError(detailsResult.error ?? "Could not load event map.");
      setLoading(false);
      return;
    }

    if (!detailsResult.data.canViewMap) {
      setError("You can only view the live map for events you host or attend.");
      setLoading(false);
      return;
    }

    if (participantsResult.error) {
      setError(participantsResult.error);
      setLoading(false);
      return;
    }

    setEventDetails(detailsResult.data);
    setParticipants(participantsResult.data ?? []);
    setIsSharing(detailsResult.data.isSharingActive);
    setLoading(false);
  }, [eventId]);

  const handleStopSharing = useCallback(async () => {
    setIsBusySharing(true);

    const { error: stopError } = await stopEventLocationSharing(eventId);

    setIsBusySharing(false);

    if (stopError) {
      setError(stopError);
      return;
    }

    setIsSharing(false);
    await loadMap();
  }, [eventId, loadMap]);

  const handleStartSharing = useCallback(async () => {
    if (!eventDetails) {
      return;
    }

    if (!isEventShareWindowOpen(eventDetails)) {
      setError("Location sharing becomes available shortly before the event starts.");
      return;
    }

    setError(null);
    setIsBusySharing(true);

    const startResult = await startEventLocationSharing({
      eventId,
      startAt: eventDetails.startAt,
      endAt: eventDetails.endAt,
    });

    if (startResult.error) {
      setIsBusySharing(false);
      setError(startResult.error);
      return;
    }

    setIsSharing(true);
    setIsBusySharing(false);
    await loadMap();
  }, [eventDetails, eventId, loadMap]);

  useEffect(() => {
    void loadMap();
  }, [loadMap]);

  useEffect(() => {
    const channel = supabase
      .channel(`event-live-locations:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_live_locations",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void loadMap();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, loadMap]);

  useEffect(() => {
    if (!eventDetails || !isSharing) {
      return;
    }

    const endTime = eventDetails.endAt?.getTime() ?? eventDetails.startAt?.getTime() ?? 0;
    if (endTime > 0 && endTime < Date.now()) {
      void handleStopSharing();
    }
  }, [eventDetails, handleStopSharing, isSharing]);

  const region = useMemo<Region>(() => {
    if (eventDetails && hasEventMapCoordinates(eventDetails)) {
      return {
        latitude: eventDetails.eventLatitude!,
        longitude: eventDetails.eventLongitude!,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }

    if (participants.length > 0) {
      return {
        latitude: participants[0].latitude,
        longitude: participants[0].longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      };
    }

    return DEFAULT_REGION;
  }, [eventDetails, participants]);

  const shareWindowOpen = eventDetails ? isEventShareWindowOpen(eventDetails) : false;

  const shareWindowLabel = useMemo(() => {
    if (!eventDetails?.startAt) {
      return "Location sharing becomes available shortly before the event starts.";
    }

    return `Sharing opens about 60 minutes before ${eventDetails.startAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}.`;
  }, [eventDetails]);

  if (loading) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator size="large" color="#1f4fa3" />
        <Text style={styles.stateText}>Loading event map...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>LIVE MAP</Text>
        <Text style={styles.heroTitle}>{eventDetails?.title ?? eventTitle}</Text>
        <Text style={styles.heroText}>
          {eventDetails?.locationLabel ?? "Location not set"}
        </Text>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {eventDetails && !hasEventMapCoordinates(eventDetails) ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Map not available yet</Text>
          <Text style={styles.infoText}>This event does not have saved coordinates yet, so live location markers cannot be placed accurately.</Text>
        </View>
      ) : null}

      {eventDetails && hasEventMapCoordinates(eventDetails) ? (
        <View style={styles.mapWrap}>
          <MapView style={styles.map} region={region}>
            <Marker
              coordinate={{
                latitude: eventDetails.eventLatitude!,
                longitude: eventDetails.eventLongitude!,
              }}
              title="Event location"
              description={eventDetails.locationLabel}
              pinColor="#1f4fa3"
            />
            {participants.map((participant) => (
              <Marker
                key={participant.id}
                coordinate={{ latitude: participant.latitude, longitude: participant.longitude }}
                title={participant.name}
                description={participant.username ? `@${participant.username}` : "Live attendee"}
                pinColor="#d97706"
              />
            ))}
          </MapView>
        </View>
      ) : null}

      {eventDetails ? (
        <View style={styles.shareCard}>
          <Text style={styles.shareTitle}>Location sharing</Text>
          {shareWindowOpen ? (
            <Text style={styles.shareText}>
              {isSharing
                ? "Your live location is being shared and will keep updating until you stop sharing or the event ends."
                : "Share your live location so other attendees can see you on the event map."}
            </Text>
          ) : (
            <Text style={styles.shareText}>{shareWindowLabel}</Text>
          )}

          <View style={styles.shareActionRow}>
            {!isSharing ? (
              <Pressable
                style={[styles.primaryButton, (!shareWindowOpen || isBusySharing) && styles.buttonDisabled]}
                onPress={() => {
                  if (!shareWindowOpen) {
                    Alert.alert("Too early to share", shareWindowLabel);
                    return;
                  }
                  void handleStartSharing();
                }}
                disabled={!shareWindowOpen || isBusySharing}
              >
                <Text style={styles.primaryButtonText}>{isBusySharing ? "Starting..." : "Share my location"}</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.secondaryButton, isBusySharing && styles.buttonDisabled]}
                onPress={() => void handleStopSharing()}
                disabled={isBusySharing}
              >
                <Text style={styles.secondaryButtonText}>{isBusySharing ? "Stopping..." : "Stop sharing"}</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}

      <View style={styles.participantsCard}>
        <Text style={styles.participantsTitle}>Live attendees</Text>
        {participants.length === 0 ? (
          <Text style={styles.emptyText}>No one is sharing their location right now.</Text>
        ) : (
          participants.map((participant) => (
            <View key={participant.id} style={styles.participantRow}>
              <View style={styles.participantTextWrap}>
                <Text style={styles.participantName}>{participant.name}</Text>
                <Text style={styles.participantMeta}>
                  {participant.username ? `@${participant.username}` : "Attendee"}
                </Text>
              </View>
              <Text style={styles.participantMeta}>
                {participant.updatedAt
                  ? new Date(participant.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "Live"}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef3fb",
  },
  content: {
    padding: 18,
    paddingBottom: 28,
  },
  stateScreen: {
    flex: 1,
    backgroundColor: "#eef3fb",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  stateText: {
    marginTop: 12,
    color: "#4c5e7b",
    fontSize: 14,
  },
  heroCard: {
    backgroundColor: "#10264a",
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
  },
  heroEyebrow: {
    color: "#9fb7db",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 8,
  },
  heroText: {
    color: "#d7e3f6",
    marginTop: 8,
    fontSize: 14,
  },
  errorCard: {
    backgroundColor: "#fff4f4",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f2d5d5",
    padding: 14,
    marginBottom: 12,
  },
  errorText: {
    color: "#a23d3d",
    fontSize: 13,
    fontWeight: "600",
  },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d8e1f2",
    padding: 14,
    marginBottom: 12,
  },
  infoTitle: {
    color: "#1a2233",
    fontSize: 16,
    fontWeight: "800",
  },
  infoText: {
    color: "#4c5e7b",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  mapWrap: {
    height: 320,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 12,
  },
  map: {
    flex: 1,
  },
  shareCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d8e1f2",
    padding: 14,
    marginBottom: 12,
  },
  shareTitle: {
    color: "#1a2233",
    fontSize: 16,
    fontWeight: "800",
  },
  shareText: {
    color: "#4c5e7b",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  shareActionRow: {
    marginTop: 12,
  },
  primaryButton: {
    backgroundColor: "#1f4fa3",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#f7f9fd",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e1f2",
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#33415c",
    fontSize: 14,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  participantsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d8e1f2",
    padding: 14,
  },
  participantsTitle: {
    color: "#1a2233",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptyText: {
    color: "#5d6a80",
    fontSize: 13,
  },
  participantRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#edf1f8",
  },
  participantTextWrap: {
    flex: 1,
    marginRight: 10,
  },
  participantName: {
    color: "#1a2233",
    fontSize: 14,
    fontWeight: "700",
  },
  participantMeta: {
    color: "#5d6a80",
    fontSize: 12,
    marginTop: 2,
  },
});
