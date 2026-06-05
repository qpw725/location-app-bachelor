import { supabase } from "../supabase";
import { getAvatarPublicUrl } from "../profile";

type EventMapRow = {
  id: string;
  title: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  start_time: string | null;
  end_time: string | null;
  creator_id: string | null;
  pre_event_window_minutes: number | null;
  live_map_enabled: boolean | null;
  status: string | null;
  ended_at: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
};

type LiveLocationRow = {
  user_id: string;
  latitude: number;
  longitude: number;
  updated_at: string | null;
};

export type EventMapDetails = {
  id: string;
  title: string;
  locationLabel: string;
  eventLatitude: number | null;
  eventLongitude: number | null;
  startAt: Date | null;
  endAt: Date | null;
  endedAt: Date | null;
  status: "scheduled" | "pre_event" | "ready" | "active" | "ended" | "cancelled";
  preEventWindowMinutes: number;
  liveMapEnabled: boolean;
  canViewMap: boolean;
};

export type LiveEventParticipant = {
  id: string;
  name: string;
  username: string;
  initials: string;
  avatarUrl: string | null;
  latitude: number;
  longitude: number;
  updatedAt: string | null;
};

function fullNameFromProfile(profile: ProfileRow | undefined) {
  if (!profile) {
    return "Unknown user";
  }

  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  const fullName = `${first} ${last}`.trim();
  return fullName || profile.username?.trim() || "Unknown user";
}

function initialsFromProfile(profile: ProfileRow | undefined) {
  const name = fullNameFromProfile(profile);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || profile?.username?.trim().charAt(0).toUpperCase() || "?";
}

export function isEventShareWindowOpen(
  event: {
    startAt: Date | null;
    endAt: Date | null;
    endedAt?: Date | null;
    status?: EventMapDetails["status"];
    preEventWindowMinutes?: number | null;
  },
  leadMinutes = 60
) {
  if (event.status === "ended" || event.status === "cancelled") {
    return false;
  }

  if (!event.startAt) {
    return false;
  }

  const windowMinutes =
    typeof event.preEventWindowMinutes === "number" && event.preEventWindowMinutes >= 0
      ? event.preEventWindowMinutes
      : leadMinutes;
  const now = Date.now();
  const startMs = event.startAt.getTime();
  const endMs = event.endedAt?.getTime() ?? event.endAt?.getTime() ?? startMs;
  return now >= startMs - windowMinutes * 60 * 1000 && now <= endMs;
}

export function hasEventMapCoordinates(event: { eventLatitude: number | null; eventLongitude: number | null }) {
  return typeof event.eventLatitude === "number" && typeof event.eventLongitude === "number";
}

export async function fetchEventMapDetails(eventId: string): Promise<{ data: EventMapDetails | null; error: string | null }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return { data: null, error: authError.message };
  }

  if (!user) {
    return { data: null, error: "Could not identify current user." };
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, location, latitude, longitude, start_time, end_time, creator_id, pre_event_window_minutes, live_map_enabled, status, ended_at")
    .eq("id", eventId)
    .maybeSingle<EventMapRow>();

  if (eventError) {
    return { data: null, error: eventError.message };
  }

  if (!event) {
    return { data: null, error: "Event not found." };
  }

  let canViewMap = event.creator_id === user.id;

  if (!canViewMap) {
    const { data: invite, error: inviteError } = await supabase
      .from("event_invites")
      .select("status")
      .eq("event_id", eventId)
      .eq("invitee_id", user.id)
      .maybeSingle<{ status: string | null }>();

    if (inviteError) {
      return { data: null, error: inviteError.message };
    }

    canViewMap = invite?.status?.toLowerCase() === "accepted";
  }

  return {
    data: {
      id: event.id,
      title: event.title?.trim() || "Untitled event",
      locationLabel: event.location?.trim() || "Location not set",
      eventLatitude: event.latitude,
      eventLongitude: event.longitude,
      startAt: event.start_time ? new Date(event.start_time) : null,
      endAt: event.end_time ? new Date(event.end_time) : null,
      endedAt: event.ended_at ? new Date(event.ended_at) : null,
      status: normalizeEventStatus(event.status),
      preEventWindowMinutes:
        typeof event.pre_event_window_minutes === "number" && event.pre_event_window_minutes >= 0
          ? event.pre_event_window_minutes
          : 60,
      liveMapEnabled: Boolean(event.live_map_enabled),
      canViewMap,
    },
    error: null,
  };
}

function normalizeEventStatus(value: string | null): EventMapDetails["status"] {
  if (
    value === "scheduled" ||
    value === "pre_event" ||
    value === "ready" ||
    value === "active" ||
    value === "ended" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "scheduled";
}

export async function fetchEventLiveParticipants(eventId: string): Promise<{ data: LiveEventParticipant[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from("event_live_locations")
    .select("user_id, latitude, longitude, updated_at")
    .eq("event_id", eventId)
    .order("updated_at", { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

  const rows = (data ?? []) as LiveLocationRow[];
  const profileIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const profileMap = new Map<string, ProfileRow>();

  if (profileIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, first_name, last_name, avatar_path")
      .in("id", profileIds);

    if (profilesError) {
      return { data: null, error: profilesError.message };
    }

    for (const profile of (profiles ?? []) as ProfileRow[]) {
      profileMap.set(profile.id, profile);
    }
  }

  const participants = rows.map((row) => {
    const profile = profileMap.get(row.user_id);
    return {
      id: row.user_id,
      name: fullNameFromProfile(profile),
      username: profile?.username?.trim() ?? "",
      initials: initialsFromProfile(profile),
      avatarUrl: getAvatarPublicUrl(profile?.avatar_path?.trim() || null),
      latitude: row.latitude,
      longitude: row.longitude,
      updatedAt: row.updated_at,
    };
  });

  return { data: participants, error: null };
}

export async function upsertMyEventLiveLocation(input: {
  eventId: string;
  latitude: number;
  longitude: number;
}): Promise<{ error: string | null }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return { error: authError.message };
  }

  if (!user) {
    return { error: "Could not identify current user." };
  }

  const { error } = await supabase.from("event_live_locations").upsert(
    [
      {
        event_id: input.eventId,
        user_id: user.id,
        latitude: input.latitude,
        longitude: input.longitude,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "event_id,user_id" }
  );

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function stopSharingMyEventLocation(eventId: string): Promise<{ error: string | null }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return { error: authError.message };
  }

  if (!user) {
    return { error: "Could not identify current user." };
  }

  const { error } = await supabase
    .from("event_live_locations")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}
