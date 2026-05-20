import { supabase } from "../supabase";
import { stopEventLocationSharing } from "../locationSharingManager";
import { getAvatarPublicUrl } from "../profile";
import { fetchEventCapacityLimit } from "./eventRules";

type DbEventRow = {
  id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  start_time: string | null;
  end_time: string | null;
  genre: string | null;
  private: boolean | null;
  creator_id: string | null;
  attendance_enabled: boolean | null;
  attendance_method: string | null;
  attendance_radius_meters: number | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_path?: string | null;
};

function fullNameFromProfile(profile: ProfileRow) {
  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  const fullName = `${first} ${last}`.trim();
  return fullName || profile.username?.trim() || "Unknown user";
}

function avatarUrlFromProfile(profile: ProfileRow) {
  const avatarPath = profile.avatar_path?.trim() ?? "";
  return avatarPath ? getAvatarPublicUrl(avatarPath) : null;
}

export type EventItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  place: string;
  latitude: number | null;
  longitude: number | null;
  host: string;
  genre: string;
  visibility: "Public" | "Private";
  startAt: Date | null;
  endAt: Date | null;
  creatorId: string | null;
  attendanceEnabled: boolean;
  attendanceMethod: string | null;
  attendanceRadiusMeters: number | null;
};

export type EventBuckets = {
  publicEvents: EventItem[];
  attendingEvents: EventItem[];
  hostingEvents: EventItem[];
  pastEvents: EventItem[];
};

export type HomeOverview = {
  upcomingCount: number;
  pendingInviteCount: number;
  hostingCount: number;
};

export type HomeActivityItem = {
  id: string;
  type: "event_invite" | "friend_request";
  title: string;
  subtitle: string;
  meta: string;
};

export type HostedEventInvitee = {
  id: string;
  username: string;
  name: string;
  status: string;
};

export type EventAttendee = {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  isHost: boolean;
};

export type EventInviteStatus = {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  status: "host" | "accepted" | "declined" | "pending";
};

function formatHostName(profile: ProfileRow | undefined, creatorId: string | null, activeUserId: string | null) {
  if (creatorId && activeUserId && creatorId === activeUserId) {
    return "You";
  }
  if (!profile) {
    return "Host";
  }
  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  const fullName = `${first} ${last}`.trim();
  return fullName || profile.username?.trim() || "Host";
}

function formatEventTime(startIso: string | null, endIso: string | null) {
  if (!startIso) {
    return "Time not set";
  }
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const dateLabel = start.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" });
  const startLabel = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (!end) {
    return `${dateLabel} at ${startLabel}`;
  }
  const endLabel = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${dateLabel} ${startLabel} - ${endLabel}`;
}

function mapEventRow(row: DbEventRow, creatorProfile: ProfileRow | undefined, activeUserId: string | null): EventItem {
  return {
    id: row.id,
    title: row.title?.trim() || "Untitled event",
    description: row.description?.trim() || "No description provided",
    time: formatEventTime(row.start_time, row.end_time),
    place: row.location?.trim() || "Location not set",
    latitude: row.latitude,
    longitude: row.longitude,
    host: formatHostName(creatorProfile, row.creator_id, activeUserId),
    genre: row.genre?.trim() || "General",
    visibility: row.private ? "Private" : "Public",
    startAt: row.start_time ? new Date(row.start_time) : null,
    endAt: row.end_time ? new Date(row.end_time) : null,
    creatorId: row.creator_id,
    attendanceEnabled: Boolean(row.attendance_enabled),
    attendanceMethod: row.attendance_method?.trim() || null,
    attendanceRadiusMeters: row.attendance_radius_meters,
  };
}

function isPastEvent(event: EventItem, now: number) {
  const endTime = event.endAt?.getTime() ?? event.startAt?.getTime();
  return typeof endTime === "number" && endTime < now;
}

function sortAscending(events: EventItem[]) {
  return [...events].sort((a, b) => (a.startAt?.getTime() ?? 0) - (b.startAt?.getTime() ?? 0));
}

function sortDescending(events: EventItem[]) {
  return [...events].sort((a, b) => (b.startAt?.getTime() ?? 0) - (a.startAt?.getTime() ?? 0));
}

export async function fetchEventBuckets(): Promise<{ data: EventBuckets | null; error: string | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { data: null, error: authError.message };
  }

  const userId = authData.user?.id ?? null;
  const eventSelect =
    "id, title, description, location, latitude, longitude, start_time, end_time, genre, private, creator_id, attendance_enabled, attendance_method, attendance_radius_meters";

  const { data: publicRows, error: publicError } = await supabase
    .from("events")
    .select(eventSelect)
    .eq("private", false)
    .order("start_time", { ascending: true });

  if (publicError) {
    return { data: null, error: publicError.message };
  }

  const acceptedInviteEventIds = new Set<string>();
  if (userId) {
    const { data: inviteRows, error: inviteError } = await supabase
      .from("event_invites")
      .select("event_id, status")
      .eq("invitee_id", userId);

    if (inviteError) {
      return { data: null, error: inviteError.message };
    }

    for (const row of ((inviteRows ?? []) as Record<string, string | null>[])) {
      const eventId = row.event_id;
      const statusValue = row.status;
      if (!eventId || !statusValue) {
        continue;
      }
      if (String(statusValue).toLowerCase() !== "accepted") {
        continue;
      }
      acceptedInviteEventIds.add(String(eventId));
    }
  }

  const invitedRows: DbEventRow[] = [];
  if (acceptedInviteEventIds.size > 0) {
    const { data, error } = await supabase
      .from("events")
      .select(eventSelect)
      .in("id", Array.from(acceptedInviteEventIds))
      .order("start_time", { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    invitedRows.push(...((data ?? []) as DbEventRow[]));
  }

  const myHostingRows: DbEventRow[] = [];
  if (userId) {
    const { data, error } = await supabase
      .from("events")
      .select(eventSelect)
      .eq("creator_id", userId)
      .order("start_time", { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    myHostingRows.push(...((data ?? []) as DbEventRow[]));
  }

  const creatorIds = Array.from(
    new Set((publicRows ?? []).concat(invitedRows, myHostingRows).map((row) => row.creator_id).filter(Boolean))
  ) as string[];
  const profileMap = new Map<string, ProfileRow>();

  if (creatorIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, first_name, last_name")
      .in("id", creatorIds);

    if (!profilesError) {
      for (const profile of (profiles ?? []) as ProfileRow[]) {
        profileMap.set(profile.id, profile);
      }
    }
  }

  const mappedPublic = ((publicRows ?? []) as DbEventRow[]).map((row) =>
    mapEventRow(row, profileMap.get(row.creator_id ?? ""), userId)
  );
  const mappedInvited = invitedRows.map((row) => mapEventRow(row, profileMap.get(row.creator_id ?? ""), userId));
  const mappedHosting = myHostingRows.map((row) => mapEventRow(row, profileMap.get(row.creator_id ?? ""), userId));

  const now = Date.now();
  const hostingEvents = sortAscending(mappedHosting.filter((event) => !isPastEvent(event, now)));
  const invitedUpcoming = mappedInvited.filter((event) => !isPastEvent(event, now));
  const hostedIds = new Set(hostingEvents.map((event) => event.id));
  const attendingEvents = sortAscending(invitedUpcoming.filter((event) => !hostedIds.has(event.id)));
  const attendingIds = new Set(attendingEvents.map((event) => event.id));
  const publicEvents = sortAscending(
    mappedPublic.filter((event) => !isPastEvent(event, now) && !hostedIds.has(event.id) && !attendingIds.has(event.id))
  );

  const pastMap = new Map<string, EventItem>();
  for (const event of mappedHosting.concat(mappedInvited)) {
    if (isPastEvent(event, now)) {
      pastMap.set(event.id, event);
    }
  }

  return {
    data: {
      publicEvents,
      attendingEvents,
      hostingEvents,
      pastEvents: sortDescending(Array.from(pastMap.values())),
    },
    error: null,
  };
}

export async function joinPublicEvent(eventId: string): Promise<{ error: string | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { error: authError.message };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { error: "Could not identify current user." };
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, private, creator_id, start_time, end_time")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    return { error: eventError.message };
  }

  if (!event) {
    return { error: "Event not found." };
  }

  if (event.creator_id === userId) {
    return { error: null };
  }

  if (event.private) {
    return { error: "This event is private and cannot be joined without an invite." };
  }

  const eventEndTime = event.end_time ? new Date(event.end_time).getTime() : event.start_time ? new Date(event.start_time).getTime() : NaN;
  if (!Number.isNaN(eventEndTime) && eventEndTime < Date.now()) {
    return { error: "This event has already ended." };
  }

  const capacityLimit = await fetchEventCapacityLimit(eventId);
  if (capacityLimit) {
    const { count, error: attendanceCountError } = await supabase
      .from("event_attendance")
      .select("event_id", { count: "exact", head: true })
      .eq("event_id", eventId);

    if (attendanceCountError) {
      return { error: attendanceCountError.message };
    }

    if ((count ?? 0) >= capacityLimit) {
      return { error: "This event is full." };
    }
  }

  const { error: joinError } = await supabase
    .from("event_invites")
    .upsert([{ event_id: eventId, invitee_id: userId, status: "accepted" }], { onConflict: "event_id,invitee_id" });

  if (joinError) {
    return { error: joinError.message };
  }

  return { error: null };
}

export async function fetchHomeOverview(): Promise<{ data: HomeOverview | null; error: string | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { data: null, error: authError.message };
  }

  const userId = authData.user?.id ?? null;
  if (!userId) {
    return {
      data: { upcomingCount: 0, pendingInviteCount: 0, hostingCount: 0 },
      error: null,
    };
  }

  const { data: hostingRows, error: hostingError } = await supabase
    .from("events")
    .select("id, start_time, end_time")
    .eq("creator_id", userId);

  if (hostingError) {
    return { data: null, error: hostingError.message };
  }

  const now = Date.now();
  const hostingEventIds = new Set<string>();
  for (const row of (hostingRows ?? []) as Array<{ id: string; start_time: string | null; end_time: string | null }>) {
    const endTime = row.end_time ? new Date(row.end_time).getTime() : row.start_time ? new Date(row.start_time).getTime() : NaN;
    if (!Number.isNaN(endTime) && endTime >= now) {
      hostingEventIds.add(row.id);
    }
  }

  const { data: inviteRows, error: inviteError } = await supabase
    .from("event_invites")
    .select("event_id, status")
    .eq("invitee_id", userId);

  if (inviteError) {
    return { data: null, error: inviteError.message };
  }

  const pendingInviteIds = new Set<string>();
  const acceptedInviteIds = new Set<string>();
  for (const row of (inviteRows ?? []) as Array<{ event_id: string | null; status: string | null }>) {
    if (!row.event_id || !row.status) {
      continue;
    }
    const status = row.status.toLowerCase();
    if (status === "pending") {
      pendingInviteIds.add(row.event_id);
    }
    if (status === "accepted") {
      acceptedInviteIds.add(row.event_id);
    }
  }

  const involvedIds = Array.from(new Set([...pendingInviteIds, ...acceptedInviteIds]));
  const upcomingPendingIds = new Set<string>();
  const upcomingAcceptedIds = new Set<string>();

  if (involvedIds.length > 0) {
    const { data: invitedEventRows, error: invitedEventsError } = await supabase
      .from("events")
      .select("id, start_time, end_time")
      .in("id", involvedIds);

    if (invitedEventsError) {
      return { data: null, error: invitedEventsError.message };
    }

    for (const row of (invitedEventRows ?? []) as Array<{ id: string; start_time: string | null; end_time: string | null }>) {
      const endTime = row.end_time ? new Date(row.end_time).getTime() : row.start_time ? new Date(row.start_time).getTime() : NaN;
      if (Number.isNaN(endTime) || endTime < now) {
        continue;
      }
      if (pendingInviteIds.has(row.id)) {
        upcomingPendingIds.add(row.id);
      }
      if (acceptedInviteIds.has(row.id) && !hostingEventIds.has(row.id)) {
        upcomingAcceptedIds.add(row.id);
      }
    }
  }

  return {
    data: {
      upcomingCount: hostingEventIds.size + upcomingAcceptedIds.size,
      pendingInviteCount: upcomingPendingIds.size,
      hostingCount: hostingEventIds.size,
    },
    error: null,
  };
}

export async function fetchHomeActivity(): Promise<{ data: HomeActivityItem[] | null; error: string | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { data: null, error: authError.message };
  }

  const userId = authData.user?.id ?? null;
  if (!userId) {
    return { data: [], error: null };
  }

  const { data: pendingFriendRows, error: friendError } = await supabase
    .from("friend_requests")
    .select("id, sender_id")
    .eq("receiver_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(3);

  if (friendError) {
    return { data: null, error: friendError.message };
  }

  const senderIds = ((pendingFriendRows ?? []) as Array<{ id: string; sender_id: string }>).map((row) => row.sender_id);
  const senderMap = new Map<string, ProfileRow>();

  if (senderIds.length > 0) {
    const { data: senderProfiles, error: senderProfilesError } = await supabase
      .from("profiles")
      .select("id, username, first_name, last_name")
      .in("id", senderIds);

    if (senderProfilesError) {
      return { data: null, error: senderProfilesError.message };
    }

    for (const profile of (senderProfiles ?? []) as ProfileRow[]) {
      senderMap.set(profile.id, profile);
    }
  }

  const friendItems: HomeActivityItem[] = ((pendingFriendRows ?? []) as Array<{ id: string; sender_id: string }>).map((row) => {
    const profile = senderMap.get(row.sender_id);
    return {
      id: `friend:${row.id}`,
      type: "friend_request",
      title: profile ? fullNameFromProfile(profile) : "Unknown user",
      subtitle: "Sent you a friend request",
      meta: profile?.username?.trim() ? `@${profile.username.trim()}` : "Friend request",
    };
  });

  const { data: pendingEventInviteRows, error: eventInviteError } = await supabase
    .from("event_invites")
    .select("event_id, invitee_id")
    .eq("invitee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(3);

  if (eventInviteError) {
    return { data: null, error: eventInviteError.message };
  }

  const pendingEventIds = ((pendingEventInviteRows ?? []) as Array<{ event_id: string; invitee_id: string }>).map((row) => row.event_id);
  const eventMap = new Map<string, DbEventRow>();
  const hostMap = new Map<string, ProfileRow>();

  if (pendingEventIds.length > 0) {
    const { data: eventRows, error: eventRowsError } = await supabase
      .from("events")
      .select(
        "id, title, description, location, latitude, longitude, start_time, end_time, genre, private, creator_id, attendance_enabled, attendance_method, attendance_radius_meters"
      )
      .in("id", pendingEventIds);

    if (eventRowsError) {
      return { data: null, error: eventRowsError.message };
    }

    for (const row of (eventRows ?? []) as DbEventRow[]) {
      eventMap.set(row.id, row);
    }

    const creatorIds = Array.from(new Set(((eventRows ?? []) as DbEventRow[]).map((row) => row.creator_id).filter(Boolean))) as string[];
    if (creatorIds.length > 0) {
      const { data: hostProfiles, error: hostProfilesError } = await supabase
        .from("profiles")
        .select("id, username, first_name, last_name")
        .in("id", creatorIds);

      if (hostProfilesError) {
        return { data: null, error: hostProfilesError.message };
      }

      for (const profile of (hostProfiles ?? []) as ProfileRow[]) {
        hostMap.set(profile.id, profile);
      }
    }
  }

  const eventItems: HomeActivityItem[] = ((pendingEventInviteRows ?? []) as Array<{ event_id: string; invitee_id: string }>)
    .map((row) => {
      const event = eventMap.get(row.event_id);
      if (!event) {
        return null;
      }
      const hostProfile = event.creator_id ? hostMap.get(event.creator_id) : undefined;
      return {
        id: `event:${row.event_id}:${row.invitee_id}`,
        type: "event_invite",
        title: event.title?.trim() || "Untitled event",
        subtitle: "Sent you an event invite",
        meta: hostProfile ? fullNameFromProfile(hostProfile) : "Unknown host",
      };
    })
    .filter((item): item is HomeActivityItem => item !== null);

  return {
    data: [...eventItems, ...friendItems].slice(0, 4),
    error: null,
  };
}

export async function deleteHostedEvent(eventId: string): Promise<{ error: string | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { error: authError.message };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { error: "Could not identify current user." };
  }

  const { data, error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("creator_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: "Event not found or you do not have permission to delete it." };
  }

  await stopEventLocationSharing(eventId);
  return { error: null };
}

export async function leaveEvent(eventId: string): Promise<{ error: string | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { error: authError.message };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { error: "Could not identify current user." };
  }

  const { data, error } = await supabase
    .from("event_invites")
    .delete()
    .eq("event_id", eventId)
    .eq("invitee_id", userId)
    .select("event_id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: "Invite not found or you do not have permission to leave this event." };
  }

  const { error: stopShareError } = await stopEventLocationSharing(eventId);
  if (stopShareError) {
    return { error: stopShareError };
  }

  return { error: null };
}

export async function updateHostedEvent(input: {
  eventId: string;
  description: string;
  location: string;
  isPrivate: boolean;
  startAt: Date;
  endAt: Date;
}): Promise<{ error: string | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { error: authError.message };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { error: "Could not identify current user." };
  }

  if (input.startAt.getTime() <= Date.now()) {
    return { error: "Start time must be in the future." };
  }

  if (input.endAt.getTime() <= input.startAt.getTime()) {
    return { error: "End time must be after start time." };
  }

  const { data, error } = await supabase
    .from("events")
    .update({
      description: input.description.trim() ? input.description.trim() : null,
      location: input.location.trim() ? input.location.trim() : null,
      private: input.isPrivate,
      start_time: input.startAt.toISOString(),
      end_time: input.endAt.toISOString(),
    })
    .eq("id", input.eventId)
    .eq("creator_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: "Event not found or you do not have permission to edit it." };
  }

  return { error: null };
}

export async function fetchHostedEventInvitees(eventId: string): Promise<{ data: HostedEventInvitee[] | null; error: string | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { data: null, error: authError.message };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { data: null, error: "Could not identify current user." };
  }

  const { data: inviteRows, error: inviteError } = await supabase
    .from("event_invites")
    .select("invitee_id, status")
    .eq("event_id", eventId);

  if (inviteError) {
    return { data: null, error: inviteError.message };
  }

  const inviteeIds = ((inviteRows ?? []) as Array<{ invitee_id: string; status: string | null }>).map((row) => row.invitee_id);
  if (inviteeIds.length === 0) {
    return { data: [], error: null };
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, first_name, last_name")
    .in("id", inviteeIds);

  if (profilesError) {
    return { data: null, error: profilesError.message };
  }

  const profileMap = new Map<string, ProfileRow>();
  for (const profile of (profiles ?? []) as ProfileRow[]) {
    profileMap.set(profile.id, profile);
  }

  return {
    data: ((inviteRows ?? []) as Array<{ invitee_id: string; status: string | null }>)
      .map((row) => {
        const profile = profileMap.get(row.invitee_id);
        if (!profile) {
          return null;
        }
        return {
          id: profile.id,
          username: profile.username?.trim() ?? "",
          name: fullNameFromProfile(profile),
          status: row.status?.trim() ?? "pending",
        };
      })
      .filter((row): row is HostedEventInvitee => row !== null)
      .sort((a, b) => a.name.localeCompare(b.name)),
    error: null,
  };
}

export async function fetchEventAttendees(eventId: string): Promise<{ data: EventAttendee[] | null; error: string | null }> {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("creator_id")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    return { data: null, error: eventError.message };
  }

  if (!event?.creator_id) {
    return { data: [], error: null };
  }

  const { data: inviteRows, error: inviteError } = await supabase
    .from("event_invites")
    .select("invitee_id, status")
    .eq("event_id", eventId);

  if (inviteError) {
    return { data: null, error: inviteError.message };
  }

  const acceptedInviteeIds = ((inviteRows ?? []) as Array<{ invitee_id: string; status: string | null }>)
    .filter((row) => row.status?.toLowerCase() === "accepted")
    .map((row) => row.invitee_id)
    .filter((id) => id !== event.creator_id);

  const profileIds = Array.from(new Set([event.creator_id, ...acceptedInviteeIds]));
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, first_name, last_name, avatar_path")
    .in("id", profileIds);

  if (profilesError) {
    return { data: null, error: profilesError.message };
  }

  const profileMap = new Map<string, ProfileRow>();
  for (const profile of (profiles ?? []) as ProfileRow[]) {
    profileMap.set(profile.id, profile);
  }

  const hostProfile = profileMap.get(event.creator_id);
  const attendees: EventAttendee[] = [];

  if (hostProfile) {
    attendees.push({
      id: hostProfile.id,
      username: hostProfile.username?.trim() ?? "",
      name: fullNameFromProfile(hostProfile),
      avatarUrl: avatarUrlFromProfile(hostProfile),
      isHost: true,
    });
  }

  attendees.push(
    ...acceptedInviteeIds
      .map((id) => {
        const profile = profileMap.get(id);
        if (!profile) {
          return null;
        }
        return {
          id: profile.id,
          username: profile.username?.trim() ?? "",
          name: fullNameFromProfile(profile),
          avatarUrl: avatarUrlFromProfile(profile),
          isHost: false,
        };
      })
      .filter((attendee): attendee is EventAttendee => attendee !== null)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  return { data: attendees, error: null };
}

export async function fetchEventInviteStatuses(eventId: string): Promise<{ data: EventInviteStatus[] | null; error: string | null }> {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("creator_id")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    return { data: null, error: eventError.message };
  }

  if (!event?.creator_id) {
    return { data: [], error: null };
  }

  const { data: inviteRows, error: inviteError } = await supabase
    .from("event_invites")
    .select("invitee_id, status")
    .eq("event_id", eventId);

  if (inviteError) {
    return { data: null, error: inviteError.message };
  }

  const invitees = ((inviteRows ?? []) as Array<{ invitee_id: string; status: string | null }>)
    .filter((row) => row.invitee_id !== event.creator_id);
  const profileIds = Array.from(new Set([event.creator_id, ...invitees.map((row) => row.invitee_id)]));

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, first_name, last_name, avatar_path")
    .in("id", profileIds);

  if (profilesError) {
    return { data: null, error: profilesError.message };
  }

  const profileMap = new Map<string, ProfileRow>();
  for (const profile of (profiles ?? []) as ProfileRow[]) {
    profileMap.set(profile.id, profile);
  }

  const hostProfile = profileMap.get(event.creator_id);
  const statuses: EventInviteStatus[] = hostProfile
    ? [
        {
          id: hostProfile.id,
          username: hostProfile.username?.trim() ?? "",
          name: fullNameFromProfile(hostProfile),
          avatarUrl: avatarUrlFromProfile(hostProfile),
          status: "host",
        },
      ]
    : [];

  statuses.push(
    ...invitees
      .map((row): EventInviteStatus | null => {
        const profile = profileMap.get(row.invitee_id);
        if (!profile) {
          return null;
        }

        const rawStatus = row.status?.trim().toLowerCase();
        const status: EventInviteStatus["status"] =
          rawStatus === "accepted" || rawStatus === "declined" ? rawStatus : "pending";

        return {
          id: profile.id,
          username: profile.username?.trim() ?? "",
          name: fullNameFromProfile(profile),
          avatarUrl: avatarUrlFromProfile(profile),
          status,
        };
      })
      .filter((row): row is EventInviteStatus => row !== null)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  return { data: statuses, error: null };
}

export async function addHostedEventInvite(eventId: string, usernameInput: string): Promise<{ data: HostedEventInvitee | null; error: string | null }> {
  const username = usernameInput.trim();
  if (!username) {
    return { data: null, error: "Enter a username first." };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { data: null, error: authError.message };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { data: null, error: "Could not identify current user." };
  }

  const { data: friendProfile, error: friendLookupError } = await supabase
    .from("profiles")
    .select("id, username, first_name, last_name")
    .ilike("username", username)
    .limit(1)
    .maybeSingle();

  if (friendLookupError) {
    return { data: null, error: friendLookupError.message };
  }

  if (!friendProfile || !friendProfile.username) {
    return { data: null, error: "Username is nonexistent." };
  }

  if (friendProfile.id === userId) {
    return { data: null, error: "You cannot invite yourself." };
  }

  const { error: inviteInsertError } = await supabase
    .from("event_invites")
    .upsert(
      [{ event_id: eventId, invitee_id: friendProfile.id, status: "pending" }],
      { onConflict: "event_id,invitee_id" }
    );

  if (inviteInsertError) {
    return { data: null, error: inviteInsertError.message };
  }

  return {
    data: {
      id: friendProfile.id,
      username: friendProfile.username.trim(),
      name: fullNameFromProfile(friendProfile),
      status: "pending",
    },
    error: null,
  };
}

export async function removeHostedEventInvite(eventId: string, inviteeId: string): Promise<{ error: string | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { error: authError.message };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { error: "Could not identify current user." };
  }

  const { data, error } = await supabase
    .from("event_invites")
    .delete()
    .eq("event_id", eventId)
    .eq("invitee_id", inviteeId)
    .select("invitee_id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: "Invite not found or you do not have permission to remove this user." };
  }

  return { error: null };
}
