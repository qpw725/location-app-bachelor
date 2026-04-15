import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  event_notifications_enabled?: boolean | null;
};

function fullNameFromProfile(profile: ProfileRow | undefined) {
  if (!profile) {
    return "Someone";
  }

  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  const fullName = `${first} ${last}`.trim();
  return fullName || profile.username?.trim() || "Someone";
}

function getExpoProjectId() {
  const envProjectId = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID?.trim();
  if (envProjectId) {
    return envProjectId;
  }

  const easProjectId =
    Constants.easConfig?.projectId ??
    ((Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? "");

  return easProjectId?.trim() || null;
}

async function storePushTokenForCurrentUser(token: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return { error: userError.message };
  }

  if (!user) {
    return { error: "Could not identify current user." };
  }

  const { error } = await supabase.from("push_tokens").upsert(
    [
      {
        user_id: user.id,
        token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "user_id,token" }
  );

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function registerPushTokenForCurrentUser(options?: {
  promptIfNeeded?: boolean;
}): Promise<{ token: string | null; error: string | null }> {
  const promptIfNeeded = options?.promptIfNeeded ?? false;
  const projectId = getExpoProjectId();

  if (!projectId) {
    return {
      token: null,
      error: "Missing Expo project id. Add EXPO_PUBLIC_EXPO_PROJECT_ID to your environment before testing push notifications.",
    };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (finalStatus !== "granted" && promptIfNeeded) {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== "granted") {
    return {
      token: null,
      error: promptIfNeeded
        ? "Notification permission was not granted."
        : null,
    };
  }

  const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = pushToken.data?.trim() ?? "";

  if (!token) {
    return { token: null, error: "Could not retrieve Expo push token." };
  }

  const storeResult = await storePushTokenForCurrentUser(token);
  if (storeResult.error) {
    return { token: null, error: storeResult.error };
  }

  return { token, error: null };
}

export async function syncPushTokenForCurrentUser() {
  return registerPushTokenForCurrentUser({ promptIfNeeded: false });
}

export async function maybeNotifyEventArrival(input: {
  eventId: string;
  latitude: number;
  longitude: number;
}) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: userError?.message ?? "Could not identify current user." };
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, latitude, longitude, creator_id")
    .eq("id", input.eventId)
    .maybeSingle<{
      id: string;
      title: string | null;
      latitude: number | null;
      longitude: number | null;
      creator_id: string | null;
    }>();

  if (eventError) {
    return { error: eventError.message };
  }

  if (!event || typeof event.latitude !== "number" || typeof event.longitude !== "number") {
    return { error: null };
  }

  const distanceMeters = getDistanceMeters(
    input.latitude,
    input.longitude,
    event.latitude,
    event.longitude
  );

  if (distanceMeters > 50) {
    return { error: null };
  }

  const { data: existingArrival, error: existingArrivalError } = await supabase
    .from("event_arrivals")
    .select("event_id")
    .eq("event_id", input.eventId)
    .eq("user_id", user.id)
    .maybeSingle<{ event_id: string }>();

  if (existingArrivalError) {
    return { error: existingArrivalError.message };
  }

  if (existingArrival) {
    return { error: null };
  }

  const { error: insertArrivalError } = await supabase.from("event_arrivals").insert({
    event_id: input.eventId,
    user_id: user.id,
    arrived_at: new Date().toISOString(),
  });

  if (insertArrivalError) {
    return { error: insertArrivalError.message };
  }

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, username")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  const actorName = fullNameFromProfile(actorProfile ?? undefined);

  const { data: inviteRows, error: inviteError } = await supabase
    .from("event_invites")
    .select("invitee_id, status")
    .eq("event_id", input.eventId);

  if (inviteError) {
    return { error: inviteError.message };
  }

  const recipientIds = new Set<string>();

  if (event.creator_id && event.creator_id !== user.id) {
    recipientIds.add(event.creator_id);
  }

  for (const row of (inviteRows ?? []) as Array<{ invitee_id: string; status: string | null }>) {
    if (row.invitee_id === user.id) {
      continue;
    }
    if (row.status?.toLowerCase() !== "accepted") {
      continue;
    }
    recipientIds.add(row.invitee_id);
  }

  if (recipientIds.size === 0) {
    return { error: null };
  }

  const { data: recipientProfiles, error: recipientProfilesError } = await supabase
    .from("profiles")
    .select("id, event_notifications_enabled")
    .in("id", Array.from(recipientIds));

  if (recipientProfilesError) {
    return { error: recipientProfilesError.message };
  }

  const enabledRecipientIds = (recipientProfiles ?? [])
    .filter((profile) => profile.event_notifications_enabled !== false)
    .map((profile) => profile.id);

  if (enabledRecipientIds.length === 0) {
    return { error: null };
  }

  const { data: tokenRows, error: tokenError } = await supabase
    .from("push_tokens")
    .select("token")
    .in("user_id", enabledRecipientIds);

  if (tokenError) {
    return { error: tokenError.message };
  }

  const tokens = Array.from(
    new Set(
      ((tokenRows ?? []) as Array<{ token: string | null }>)
        .map((row) => row.token?.trim() ?? "")
        .filter(Boolean)
    )
  );

  if (tokens.length === 0) {
    return { error: null };
  }

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      tokens.map((token) => ({
        to: token,
        sound: "default",
        title: event.title?.trim() || "Event update",
        body: `${actorName} has arrived`,
        data: {
          type: "event_arrival",
          eventId: input.eventId,
        },
      }))
    ),
  });

  return { error: null };
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
