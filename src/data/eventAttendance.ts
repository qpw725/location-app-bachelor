import * as Location from "expo-location";
import type { EventItem } from "./eventStore";
import { supabase } from "../supabase";

export type GpsAttendanceResult =
  | { status: "checked_in"; distanceMeters: number }
  | { status: "already_checked_in" }
  | { status: "outside_geofence"; distanceMeters: number; radiusMeters: number }
  | { status: "not_available"; reason: string }
  | { status: "error"; reason: string };

export function isEventOngoing(event: Pick<EventItem, "startAt" | "endAt">) {
  if (!event.startAt || !event.endAt) {
    return false;
  }

  const now = Date.now();
  return now >= event.startAt.getTime() && now <= event.endAt.getTime();
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
    .eq("event_id", eventId);

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: count ?? 0, error: null };
}

export async function autoCheckInWithGpsGeofence(event: EventItem): Promise<GpsAttendanceResult> {
  if (!event.attendanceEnabled) {
    return { status: "not_available", reason: "Attendance counting is not enabled for this event." };
  }

  if (event.attendanceMethod !== "gps_geofence") {
    return { status: "not_available", reason: "This event is not using GPS attendance." };
  }

  if (!isEventOngoing(event)) {
    return { status: "not_available", reason: "Attendance is only counted while the event is ongoing." };
  }

  if (!canUseGpsAttendance(event)) {
    return { status: "not_available", reason: "This event is missing GPS attendance settings." };
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

  if (existingAttendance) {
    return { status: "already_checked_in" };
  }

  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) {
    permission = await Location.requestForegroundPermissionsAsync();
  }

  if (!permission.granted) {
    return { status: "not_available", reason: "Location permission is needed to count GPS attendance." };
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  const distanceMeters = getDistanceMeters(
    position.coords.latitude,
    position.coords.longitude,
    event.latitude!,
    event.longitude!
  );

  const radiusMeters = event.attendanceRadiusMeters!;
  if (distanceMeters > radiusMeters) {
    return { status: "outside_geofence", distanceMeters, radiusMeters };
  }

  const { error: insertError } = await supabase.from("event_attendance").upsert(
    [
      {
        event_id: event.id,
        user_id: user.id,
        checked_in_at: new Date().toISOString(),
        method: "gps_geofence",
      },
    ],
    { onConflict: "event_id,user_id" }
  );

  if (insertError) {
    return { status: "error", reason: insertError.message };
  }

  return { status: "checked_in", distanceMeters };
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

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
