import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import MapView, { Marker, Region } from "react-native-maps";
import type { RootStackParamList } from "../../../App";
import {
  fetchEventLiveParticipants,
  fetchEventMapDetails,
  hasEventMapCoordinates,
  isEventShareWindowOpen,
  type EventMapDetails,
  type LiveEventParticipant,
} from "../../data/eventLiveLocation";
import { supabase } from "../../supabase";
import { colors, commonStyles } from "../../styles/common";

type Props = NativeStackScreenProps<RootStackParamList, "LiveEventMap">;

const DEFAULT_REGION: Region = {
  latitude: 55.6761,
  longitude: 12.5683,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function LiveEventMapScreen({ route }: Props) {
  const { eventId, eventTitle } = route.params;
  const [eventDetails, setEventDetails] = useState<EventMapDetails | null>(null);
  const [participants, setParticipants] = useState<LiveEventParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMap = useCallback(async () => {
    setError(null);

    const detailsResult = await fetchEventMapDetails(eventId);

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

    setEventDetails(detailsResult.data);

    if (!detailsResult.data.liveMapEnabled) {
      setParticipants([]);
      setLoading(false);
      return;
    }

    if (!isEventShareWindowOpen(detailsResult.data)) {
      setParticipants([]);
      setLoading(false);
      return;
    }

    const participantsResult = await fetchEventLiveParticipants(eventId);

    if (participantsResult.error) {
      setError(participantsResult.error);
      setLoading(false);
      return;
    }

    setParticipants(participantsResult.data ?? []);
    setLoading(false);
  }, [eventId]);

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

  const shareWindowLabel = useMemo(() => {
    if (!eventDetails?.startAt) {
      return "Live map locations become available shortly before the event starts.";
    }

    return `Live map updates open about 60 minutes before ${eventDetails.startAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}.`;
  }, [eventDetails]);

  if (loading) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.stateText}>Loading event map...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={commonStyles.screen} contentContainerStyle={commonStyles.scrollContent}>
      <View style={commonStyles.heroCard}>
        <Text style={commonStyles.heroEyebrow}>LIVE MAP</Text>
        <Text style={commonStyles.heroTitle}>{eventDetails?.title ?? eventTitle}</Text>
        <Text style={commonStyles.heroSubtitle}>
          {eventDetails?.locationLabel ?? "Location not set"}
        </Text>
      </View>

      {error ? (
        <View style={commonStyles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {eventDetails && !hasEventMapCoordinates(eventDetails) ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Map not available yet</Text>
          <Text style={styles.infoText}>This event does not have saved coordinates yet, so live location markers cannot be placed accurately.</Text>
        </View>
      ) : null}

      {eventDetails && !eventDetails.liveMapEnabled ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Live map disabled</Text>
          <Text style={styles.infoText}>This event does not show attendee locations on the live map.</Text>
        </View>
      ) : null}

      {eventDetails && eventDetails.liveMapEnabled && !isEventShareWindowOpen(eventDetails) ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Live map not open yet</Text>
          <Text style={styles.infoText}>{shareWindowLabel}</Text>
        </View>
      ) : null}

      {eventDetails && eventDetails.liveMapEnabled && isEventShareWindowOpen(eventDetails) && hasEventMapCoordinates(eventDetails) ? (
        <View style={styles.mapWrap}>
          <MapView style={styles.map} region={region}>
            <Marker
              coordinate={{
                latitude: eventDetails.eventLatitude!,
                longitude: eventDetails.eventLongitude!,
              }}
              title="Event location"
              description={eventDetails.locationLabel}
              tracksViewChanges={false}
              zIndex={1000}
            >
              <View style={styles.eventMarker}>
                <View style={styles.eventMarkerDot} />
              </View>
            </Marker>
            {participants.map((participant) => (
              <Marker
                key={participant.id}
                coordinate={{ latitude: participant.latitude, longitude: participant.longitude }}
                title={participant.name}
                description={participant.username ? `@${participant.username}` : "Live attendee"}
                tracksViewChanges={false}
              >
                <View style={styles.avatarMarker}>
                  {participant.avatarUrl ? (
                    <Image source={{ uri: participant.avatarUrl }} style={styles.avatarMarkerImage} resizeMode="cover" />
                  ) : (
                    <Text style={styles.avatarMarkerText}>{participant.initials}</Text>
                  )}
                </View>
              </Marker>
            ))}
          </MapView>
        </View>
      ) : null}

      <View style={styles.participantsCard}>
        <Text style={styles.participantsTitle}>Live attendees</Text>
        {!eventDetails?.liveMapEnabled ? (
          <Text style={styles.emptyText}>Live attendee locations are disabled for this event.</Text>
        ) : participants.length === 0 ? (
          <Text style={styles.emptyText}>No current GPS presence updates are available right now.</Text>
        ) : (
          participants.map((participant) => (
            <View key={participant.id} style={styles.participantRow}>
              <View style={styles.participantAvatar}>
                {participant.avatarUrl ? (
                  <Image source={{ uri: participant.avatarUrl }} style={styles.participantAvatarImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.participantAvatarText}>{participant.initials}</Text>
                )}
              </View>
              <View style={styles.participantTextWrap}>
                <Text style={styles.participantName}>{participant.name}</Text>
                <Text style={styles.participantMeta}>
                  {participant.username ? `@${participant.username}` : "Attendee"}
                </Text>
              </View>
                <Text style={styles.participantMeta}>
                  {formatParticipantStatus(participant, eventDetails)}
                </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function formatParticipantStatus(participant: LiveEventParticipant, eventDetails: EventMapDetails | null) {
  const updatedLabel = participant.updatedAt
    ? new Date(participant.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "Live";
  const distanceLabel = getDistanceLabel(participant, eventDetails);

  return distanceLabel ? `${updatedLabel} - ${distanceLabel}` : updatedLabel;
}

function getDistanceLabel(participant: LiveEventParticipant, eventDetails: EventMapDetails | null) {
  if (!eventDetails || !hasEventMapCoordinates(eventDetails)) {
    return null;
  }

  const meters = getDistanceMeters(
    participant.latitude,
    participant.longitude,
    eventDetails.eventLatitude!,
    eventDetails.eventLongitude!
  );

  if (meters < 1000) {
    return `${Math.round(meters)} m away`;
  }

  return `${(meters / 1000).toFixed(1)} km away`;
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6371000;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const styles = StyleSheet.create({
  stateScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  stateText: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  infoTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  infoText: {
    color: colors.textSubtle,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  mapWrap: {
    height: 320,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  map: {
    flex: 1,
  },
  eventMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: "#ffffff",
    backgroundColor: "#1f4fa3",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 8,
  },
  eventMarkerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ffffff",
  },
  avatarMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: "#ffffff",
    backgroundColor: "#e3e7ef",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarMarkerImage: {
    width: "100%",
    height: "100%",
  },
  avatarMarkerText: {
    color: "#1f4fa3",
    fontSize: 13,
    fontWeight: "800",
  },
  participantsCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  participantsTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  participantAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#e3e7ef",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 10,
  },
  participantAvatarImage: {
    width: "100%",
    height: "100%",
  },
  participantAvatarText: {
    color: "#1f4fa3",
    fontSize: 13,
    fontWeight: "800",
  },
  participantTextWrap: {
    flex: 1,
    marginRight: 10,
  },
  participantName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  participantMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
