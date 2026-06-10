import * as Location from "expo-location";
import type { EventItem } from "./eventStore";
import { supabase } from "../supabase";

export type GpsAttendanceResult =
  | { status: "checked_in"; distanceMeters: number }
  | { status: "already_checked_in" }
  | { status: "outside_geofence"; distanceMeters: number; radiusMeters: number }
  | { status: "not_available"; reason: string }
  | { status: "error"; reason: string };

export type GpsPresenceWatchResult = GpsAttendanceResult | { status: "watching" };

export type GpsPresenceWatch = {
  stop: () => void;
};

type GpsPresenceAvailability = {
  userId: string;
};

type ExistingAttendanceRow = {
  event_id: string;
  checked_out_at: string | null;
};

export function isEventOngoing(event: Pick<EventItem, "startAt" | "endAt">) {
  if (!event.startAt || !event.endAt) {
    return false;
  }

  const now = Date.now();
  return now >= event.startAt.getTime() && now <= event.endAt.getTime();
}

export function isEventPresenceWindowOpen(
  event: Pick<EventItem, "startAt" | "endAt"> & { preEventWindowMinutes?: number | null },
  leadMinutes = 60
) {
  if (!event.startAt || !event.endAt) {
    return false;
  }

  const windowMinutes =
    typeof event.preEventWindowMinutes === "number" && event.preEventWindowMinutes >= 0
      ? event.preEventWindowMinutes
      : leadMinutes;
  const now = Date.now();
  return now >= event.startAt.getTime() - windowMinutes * 60 * 1000 && now <= event.endAt.getTime();
}

export function canUseGpsAttendance(event: EventItem) {
  return (
    event.attendanceEnabled &&
    event.attendanceMethod === "gps_geofence" &&
    typeof event.latitude === "number" &&
    typeof event.longitude === "number" &&
    typeof event.attendanceRadiusMeters === "number" &&
    event.attendanceRadiusMeters > 0
  );
}

export async function fetchEventAttendanceCount(eventId: string): Promise<{ count: number; error: string | null }> {
  const { count, error } = await supabase
    .from("event_attendance")
    .select("event_id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .is("checked_out_at", null);

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: count ?? 0, error: null };
}

export async function autoCheckInWithGpsGeofence(event: EventItem): Promise<GpsAttendanceResult> {
  const availability = await prepareGpsPresenceCheck(event);
  if ("status" in availability) {
    return availability;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return updateGpsPresenceFromCoordinates(event, availability.userId, position.coords.latitude, position.coords.longitude);
}

export async function startGpsPresenceWatch(
  event: EventItem,
  onUpdate: (result: GpsPresenceWatchResult) => void
): Promise<GpsPresenceWatch> {
  const availability = await prepareGpsPresenceCheck(event, { allowExistingAttendance: true });
  if ("status" in availability) {
    onUpdate(availability);
    return { stop: () => {} };
  }

  const userId = availability.userId;
  let stopped = false;
  let subscription: Location.LocationSubscription | null = null;

  async function handlePosition(latitude: number, longitude: number) {
    if (stopped) {
      return;
    }

    const result = await updateGpsPresenceFromCoordinates(event, userId, latitude, longitude);
    if (stopped) {
      return;
    }

    onUpdate(result);
  }

  onUpdate({ status: "watching" });

  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000,
      distanceInterval: Math.max(10, Math.min(50, Math.round((event.attendanceRadiusMeters ?? 75) / 4))),
    },
    (position) => {
      void handlePosition(position.coords.latitude, position.coords.longitude);
    }
  );

  Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    .then((position) => handlePosition(position.coords.latitude, position.coords.longitude))
    .catch((error: unknown) => {
      if (!stopped) {
        onUpdate({ status: "error", reason: getErrorMessage(error) });
      }
    });

  return {
    stop: () => {
      stopped = true;
      subscription?.remove();
      subscription = null;
    },
  };
}

async function prepareGpsPresenceCheck(
  event: EventItem,
  options: { allowExistingAttendance?: boolean } = {}
): Promise<GpsPresenceAvailability | GpsAttendanceResult> {
  if (!event.attendanceEnabled) {
    return { status: "not_available", reason: "Presence detection is not enabled for this event." };
  }

  if (event.attendanceMethod !== "gps_geofence") {
    return { status: "not_available", reason: "This event is not using GPS presence detection." };
  }

  if (!isEventPresenceWindowOpen(event)) {
    return { status: "not_available", reason: "Presence can only be marked shortly before or during the event." };
  }

  if (!canUseGpsAttendance(event)) {
    return { status: "not_available", reason: "This event is missing GPS presence settings." };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return { status: "error", reason: authError.message };
  }

  if (!user) {
    return { status: "error", reason: "Could not identify current user." };
  }

  const { data: existingAttendance, error: existingError } = await supabase
    .from("event_attendance")
    .select("event_id")
    .eq("event_id", event.id)
    .eq("user_id", user.id)
    .maybeSingle<{ event_id: string }>();

  if (existingError) {
    return { status: "error", reason: existingError.message };
  }

  if (existingAttendance && !options.allowExistingAttendance) {
    return { status: "already_checked_in" };
  }

  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) {
    permission = await Location.requestForegroundPermissionsAsync();
  }

  if (!permission.granted) {
    return { status: "not_available", reason: "Location permission is needed to mark presence." };
  }

  return { userId: user.id };
}

export async function updateGpsPresenceFromCoordinates(
  event: EventItem,
  userId: string,
  latitude: number,
  longitude: number
): Promise<GpsAttendanceResult> {
  const { error: liveLocationError } = await supabase.from("event_live_locations").upsert(
    [
      {
        event_id: event.id,
        user_id: userId,
        latitude,
        longitude,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "event_id,user_id" }
  );

  if (liveLocationError) {
    return { status: "error", reason: liveLocationError.message };
  }

  const distanceMeters = getDistanceMeters(
    latitude,
    longitude,
    event.latitude!,
    event.longitude!
  );

  const radiusMeters = event.attendanceRadiusMeters!;
  const { data: existingAttendance, error: existingAttendanceError } = await supabase
    .from("event_attendance")
    .select("event_id, checked_out_at")
    .eq("event_id", event.id)
    .eq("user_id", userId)
    .maybeSingle<ExistingAttendanceRow>();

  if (existingAttendanceError) {
    return { status: "error", reason: existingAttendanceError.message };
  }

  if (distanceMeters > radiusMeters) {
    if (existingAttendance && !existingAttendance.checked_out_at) {
      const { error: checkoutError } = await supabase
        .from("event_attendance")
        .update({ checked_out_at: new Date().toISOString() })
        .eq("event_id", event.id)
        .eq("user_id", userId);

      if (checkoutError) {
        return { status: "error", reason: checkoutError.message };
      }
    }

    return { status: "outside_geofence", distanceMeters, radiusMeters };
  }

  if (existingAttendance) {
    if (existingAttendance.checked_out_at) {
      const { error: reenterError } = await supabase
        .from("event_attendance")
        .update({ checked_out_at: null })
        .eq("event_id", event.id)
        .eq("user_id", userId);

      if (reenterError) {
        return { status: "error", reason: reenterError.message };
      }
    }

    return { status: "checked_in", distanceMeters };
  }

  const { error: insertError } = await supabase.from("event_attendance").insert([
    {
      event_id: event.id,
      user_id: userId,
      checked_in_at: new Date().toISOString(),
      checked_out_at: null,
      method: "gps_geofence",
    },
  ]);

  if (insertError) {
    return { status: "error", reason: insertError.message };
  }

  return { status: "checked_in", distanceMeters };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Could not read current location.";
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
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
