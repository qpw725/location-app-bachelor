import { getAvatarPublicUrl } from "../profile";
import { supabase } from "../supabase";
import type { EventItem } from "./eventStore";

export type EventTriggerType =
  | "participant_enters_area"
  | "participant_leaves_area"
  | "host_enters_area"
  | "host_leaves_area"
  | "minimum_present"
  | "missing_after_start"
  | "capacity_warning"
  | "scheduled_start"
  | "scheduled_end";

export type EventTriggerInput = {
  type: EventTriggerType;
  config: Record<string, unknown>;
};

type EventTriggerRow = {
  type: string | null;
  enabled: boolean | null;
  config: Record<string, unknown> | null;
};

type InviteRow = {
  invitee_id: string;
  status: string | null;
};

type AttendanceRow = {
  user_id: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
};

type LiveLocationRow = {
  user_id: string;
  latitude: number;
  longitude: number;
  updated_at: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
};

export type EventPresencePerson = {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  isHost: boolean;
  isPresent: boolean;
  hasCheckedIn: boolean;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  lastLocationAt: string | null;
  distanceMeters: number | null;
  presenceState: "present" | "not_arrived" | "left" | "stale";
};

export type EventRuntimeStatusId =
  | "hidden"
  | "scheduled"
  | "pre_event"
  | "not_started"
  | "host_not_arrived"
  | "host_left"
  | "not_enough_participants"
  | "event_full"
  | "ready"
  | "active"
  | "ended";

export type EventRuntimeSeverity = "neutral" | "warning" | "success" | "danger";

export type EventRuntimeStatus = {
  status: EventRuntimeStatusId;
  severity: EventRuntimeSeverity;
  title: string;
  message: string;
  canShowLiveState: boolean;
  presentCount: number;
  acceptedCount: number;
  participants: EventPresencePerson[];
  missingParticipants: EventPresencePerson[];
  leftParticipants: EventPresencePerson[];
  viewerPresence: EventPresencePerson | null;
  hostPresent: boolean;
  minimumPresentCount: number | null;
  capacityLimit: number | null;
  endedByHostLeaving?: boolean;
};

const STATUS_LEAD_MINUTES = 60;
const DEFAULT_MISSING_AFTER_MINUTES = 10;
const CURRENT_LOCATION_MAX_AGE_MS = 2 * 60 * 1000;

export async function saveEventBehaviorTriggers(eventId: string, triggers: EventTriggerInput[]) {
  if (triggers.length === 0) {
    return { error: null };
  }

  const rows = triggers.map((trigger) => ({
    event_id: eventId,
    type: trigger.type,
    enabled: true,
    config: trigger.config,
  }));

  const { error } = await supabase.from("event_triggers").upsert(rows, { onConflict: "event_id,type" });

  if (isMissingTriggerTableError(error)) {
    console.warn("[EventRules] event_triggers table is missing. Trigger settings were not saved.");
    return { error: null };
  }

  return { error: error?.message ?? null };
}

export async function fetchEventRuntimeStatus(input: {
  event: EventItem;
  viewerRole: "hosting" | "attending" | "past";
}): Promise<{ data: EventRuntimeStatus | null; error: string | null }> {
  const [triggersResult, presenceResult, authResult] = await Promise.all([
    fetchEventTriggers(input.event.id),
    fetchEventPresencePeople(input.event),
    supabase.auth.getUser(),
  ]);

  if (triggersResult.error) {
    return { data: null, error: triggersResult.error };
  }

  if (authResult.error) {
    return { data: null, error: authResult.error.message };
  }

  if (presenceResult.error || !presenceResult.data) {
    return { data: null, error: presenceResult.error ?? "Could not load event presence." };
  }

  return {
    data: deriveRuntimeStatus({
      event: input.event,
      viewerRole: input.viewerRole,
      viewerId: authResult.data.user?.id ?? null,
      triggers: triggersResult.data,
      people: presenceResult.data,
    }),
    error: null,
  };
}

export async function fetchEventCapacityLimit(eventId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("event_triggers")
    .select("config")
    .eq("event_id", eventId)
    .eq("type", "capacity_warning")
    .eq("enabled", true)
    .limit(1)
    .maybeSingle<{ config: Record<string, unknown> | null }>();

  if (isMissingTriggerTableError(error) || error || !data?.config) {
    return null;
  }

  return readNumber(data.config, ["presentCount", "count", "capacity"]);
}

export async function endHostedEventNow(eventId: string): Promise<{ error: string | null }> {
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

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("events")
    .update({ status: "ended", ended_at: nowIso, ended_reason: "host_left_area" })
    .eq("id", eventId)
    .eq("creator_id", user.id);

  return { error: error?.message ?? null };
}

async function fetchEventTriggers(eventId: string): Promise<{ data: EventTriggerRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("event_triggers")
    .select("type, enabled, config")
    .eq("event_id", eventId)
    .eq("enabled", true);

  if (isMissingTriggerTableError(error)) {
    return { data: getDefaultTriggers(), error: null };
  }

  if (error) {
    return { data: [], error: error.message };
  }

  const rows = ((data ?? []) as EventTriggerRow[]).filter((row) => row.type);
  return { data: rows.length > 0 ? rows : getDefaultTriggers(), error: null };
}

async function fetchEventPresencePeople(event: EventItem): Promise<{ data: EventPresencePerson[] | null; error: string | null }> {
  if (!event.creatorId) {
    return { data: [], error: null };
  }

  const [
    { data: inviteRows, error: inviteError },
    { data: attendanceRows, error: attendanceError },
    { data: liveLocationRows, error: liveLocationError },
  ] = await Promise.all([
    supabase.from("event_invites").select("invitee_id, status").eq("event_id", event.id),
    supabase.from("event_attendance").select("user_id, checked_in_at, checked_out_at").eq("event_id", event.id),
    supabase.from("event_live_locations").select("user_id, latitude, longitude, updated_at").eq("event_id", event.id),
  ]);

  if (inviteError) {
    return { data: null, error: inviteError.message };
  }

  if (attendanceError) {
    return { data: null, error: attendanceError.message };
  }

  if (liveLocationError) {
    return { data: null, error: liveLocationError.message };
  }

  const acceptedInviteIds = ((inviteRows ?? []) as InviteRow[])
    .filter((row) => row.status?.toLowerCase() === "accepted")
    .map((row) => row.invitee_id)
    .filter((id) => id !== event.creatorId);

  const participantIds = Array.from(new Set([event.creatorId, ...acceptedInviteIds]));
  const attendanceMap = new Map<string, AttendanceRow>();
  for (const row of (attendanceRows ?? []) as AttendanceRow[]) {
    attendanceMap.set(row.user_id, row);
  }

  const liveLocationMap = new Map<string, LiveLocationRow>();
  for (const row of (liveLocationRows ?? []) as LiveLocationRow[]) {
    liveLocationMap.set(row.user_id, row);
  }

  if (participantIds.length === 0) {
    return { data: [], error: null };
  }

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, first_name, last_name, avatar_path")
    .in("id", participantIds);

  if (profileError) {
    return { data: null, error: profileError.message };
  }

  const profileMap = new Map<string, ProfileRow>();
  for (const profile of (profileRows ?? []) as ProfileRow[]) {
    profileMap.set(profile.id, profile);
  }

  const people = participantIds
    .map((id): EventPresencePerson | null => {
      const profile = profileMap.get(id);
      if (!profile) {
        return null;
      }

      const liveLocation = liveLocationMap.get(id);
      const attendance = attendanceMap.get(id);
      const checkedInAt = attendance?.checked_in_at ?? null;
      const checkedOutAt = attendance?.checked_out_at ?? null;
      const hasCheckedIn = attendanceMap.has(id);
      const distanceMeters =
        liveLocation && hasEventCoordinates(event)
          ? getDistanceMeters(liveLocation.latitude, liveLocation.longitude, event.latitude!, event.longitude!)
          : null;
      const lastLocationMs = liveLocation?.updated_at ? new Date(liveLocation.updated_at).getTime() : NaN;
      const hasFreshLocation = Number.isFinite(lastLocationMs) && Date.now() - lastLocationMs <= CURRENT_LOCATION_MAX_AGE_MS;
      const isInsideArea =
        hasFreshLocation &&
        typeof distanceMeters === "number" &&
        typeof event.attendanceRadiusMeters === "number" &&
        distanceMeters <= event.attendanceRadiusMeters;
      const presenceState = getPresenceState({
        isInsideArea,
        hasCheckedIn,
        hasLiveLocation: Boolean(liveLocation),
        hasFreshLocation,
      });

      return {
        id,
        username: profile.username?.trim() ?? "",
        name: fullNameFromProfile(profile),
        avatarUrl: getAvatarPublicUrl(profile.avatar_path?.trim() || null),
        isHost: id === event.creatorId,
        isPresent: presenceState === "present",
        hasCheckedIn,
        checkedInAt,
        checkedOutAt,
        lastLocationAt: liveLocation?.updated_at ?? null,
        distanceMeters,
        presenceState,
      };
    })
    .filter((person): person is EventPresencePerson => person !== null);

  return { data: people, error: null };
}

function deriveRuntimeStatus(input: {
  event: EventItem;
  viewerRole: "hosting" | "attending" | "past";
  viewerId: string | null;
  triggers: EventTriggerRow[];
  people: EventPresencePerson[];
}): EventRuntimeStatus {
  const { event, viewerRole, viewerId, triggers, people } = input;
  const now = Date.now();
  const startMs = event.startAt?.getTime() ?? NaN;
  const endMs = event.endAt?.getTime() ?? NaN;
  const endedMs = event.endedAt?.getTime() ?? NaN;
  const leadMinutes = event.preEventWindowMinutes ?? STATUS_LEAD_MINUTES;
  const statusOpenMs = Number.isFinite(startMs) ? startMs - leadMinutes * 60 * 1000 : NaN;
  const isHostViewer = viewerRole === "hosting";
  const canShowLiveState =
    isHostViewer ||
    event.status === "pre_event" ||
    event.status === "ready" ||
    event.status === "active" ||
    !Number.isFinite(statusOpenMs) ||
    now >= statusOpenMs;

  const acceptedParticipants = people.filter((person) => !person.isHost);
  const presentCount = acceptedParticipants.filter((person) => person.isPresent).length;
  const acceptedCount = acceptedParticipants.length;
  const host = people.find((person) => person.isHost);
  const viewerPresence = viewerId ? people.find((person) => person.id === viewerId) ?? null : null;
  const hostPresent = Boolean(host?.isPresent);
  const isManuallyActivated = event.status === "active";
  const hostRule = getHostPresenceRule(triggers);
  const hostRequired = hostRule.requireHostPresence;
  const hostLeavesEndsEvent = hostRule.endWhenHostLeaves;
  const hostHasLeftAfterArriving = Boolean(host?.hasCheckedIn && !hostPresent);
  const canEndFromHostLeaving = isManuallyActivated || !Number.isFinite(startMs) || now >= startMs;
  const missingTriggerEnabled = hasTrigger(triggers, "missing_after_start");
  const minimumPresentCount = getMinimumPresentCount(triggers);
  const capacityLimit = getCapacityLimit(triggers);
  const missingAfterMinutes = missingTriggerEnabled ? getMissingAfterMinutes(triggers) : null;
  const missingVisible =
    missingTriggerEnabled &&
    (!Number.isFinite(startMs) ||
      now >= startMs + (missingAfterMinutes ?? DEFAULT_MISSING_AFTER_MINUTES) * 60 * 1000 ||
      (Number.isFinite(endMs) && now > endMs));
  const missingParticipants = missingVisible
    ? acceptedParticipants.filter((person) => person.presenceState === "not_arrived")
    : [];
  const leftParticipants = acceptedParticipants.filter((person) => person.presenceState === "left" || person.presenceState === "stale");
  const createRuntimeStatus = (status: Omit<EventRuntimeStatus, "participants">) =>
    createStatus(status, acceptedParticipants);
  const isBeforeStart = Number.isFinite(startMs) && now < startMs;
  const isInPreEventWindow = Number.isFinite(statusOpenMs) && now >= statusOpenMs && isBeforeStart;
  const canAutoStartBeforeScheduledTime = event.startMode === "auto_on_ready";
  const isManualStartRequired = event.startMode === "manual" && !isManuallyActivated;

  if (event.status === "ended" || (Number.isFinite(endedMs) && now >= endedMs)) {
    return createRuntimeStatus({
      status: "ended",
      severity: "neutral",
      title: "Event ended",
      message: `${presentCount} participant${presentCount === 1 ? "" : "s"} were marked present.`,
      canShowLiveState,
      presentCount,
      acceptedCount,
      missingParticipants,
      leftParticipants,
      viewerPresence,
      hostPresent,
      minimumPresentCount,
      capacityLimit,
    });
  }

  if (!canShowLiveState) {
    return createRuntimeStatus({
      status: "hidden",
      severity: "neutral",
      title: "Status updates not open yet",
      message: `Live event behavior appears ${leadMinutes} minutes before the event starts.`,
      canShowLiveState,
      presentCount,
      acceptedCount,
      missingParticipants: [],
      leftParticipants: [],
      viewerPresence,
      hostPresent,
      minimumPresentCount,
      capacityLimit,
    });
  }

  if (!isInPreEventWindow && isHostViewer && Number.isFinite(statusOpenMs) && now < statusOpenMs) {
    return createRuntimeStatus({
      status: "scheduled",
      severity: "neutral",
      title: "Event scheduled",
      message: `Live event behavior opens ${leadMinutes} minutes before the event starts.`,
      canShowLiveState,
      presentCount,
      acceptedCount,
      missingParticipants: [],
      leftParticipants: [],
      viewerPresence,
      hostPresent,
      minimumPresentCount,
      capacityLimit,
    });
  }

  if (Number.isFinite(endMs) && now > endMs) {
    return createRuntimeStatus({
      status: "ended",
      severity: "neutral",
      title: "Event ended",
      message: `${presentCount} participant${presentCount === 1 ? "" : "s"} were marked present.`,
      canShowLiveState,
      presentCount,
      acceptedCount,
      missingParticipants,
      leftParticipants,
      viewerPresence,
      hostPresent,
      minimumPresentCount,
      capacityLimit,
    });
  }

  if (hostLeavesEndsEvent && hostHasLeftAfterArriving && canEndFromHostLeaving) {
    return createRuntimeStatus({
      status: "ended",
      severity: "warning",
      title: "Event ended",
      message: "The host left the event area, so the event has stopped.",
      canShowLiveState,
      presentCount,
      acceptedCount,
      missingParticipants,
      leftParticipants,
      viewerPresence,
      hostPresent,
      minimumPresentCount,
      capacityLimit,
      endedByHostLeaving: true,
    });
  }

  if (capacityLimit && presentCount >= capacityLimit) {
    return createRuntimeStatus({
      status: "event_full",
      severity: "danger",
      title: "Event full",
      message: `Capacity has been reached with ${presentCount} present participants.`,
      canShowLiveState,
      presentCount,
      acceptedCount,
      missingParticipants,
      leftParticipants,
      viewerPresence,
      hostPresent,
      minimumPresentCount,
      capacityLimit,
    });
  }

  if (hostRequired && !hostPresent) {
    if (host?.hasCheckedIn) {
      return createRuntimeStatus({
        status: "host_left",
        severity: "warning",
        title: "Host left event area",
        message: "The host has been marked present before, but is not currently inside the event area.",
        canShowLiveState,
        presentCount,
        acceptedCount,
        missingParticipants,
        leftParticipants,
        viewerPresence,
        hostPresent,
        minimumPresentCount,
        capacityLimit,
      });
    }

    return createRuntimeStatus({
      status: "host_not_arrived",
      severity: "warning",
      title: "Host not arrived",
      message: "The event is waiting for the host to be physically present.",
      canShowLiveState,
      presentCount,
      acceptedCount,
      missingParticipants,
      leftParticipants,
      viewerPresence,
      hostPresent,
      minimumPresentCount,
      capacityLimit,
    });
  }

  if (minimumPresentCount && presentCount < minimumPresentCount) {
    return createRuntimeStatus({
      status: "not_enough_participants",
      severity: "warning",
      title: "Not enough participants",
      message: `${presentCount} of ${minimumPresentCount} required participants are present.`,
      canShowLiveState,
      presentCount,
      acceptedCount,
      missingParticipants,
      leftParticipants,
      viewerPresence,
      hostPresent,
      minimumPresentCount,
      capacityLimit,
    });
  }

  if (Number.isFinite(startMs) && now < startMs) {
    if (minimumPresentCount && presentCount >= minimumPresentCount) {
      return createRuntimeStatus({
        status: canAutoStartBeforeScheduledTime || isManuallyActivated ? "active" : "ready",
        severity: "success",
        title: canAutoStartBeforeScheduledTime || isManuallyActivated ? "Event active" : "Event ready",
        message: canAutoStartBeforeScheduledTime || isManuallyActivated
          ? `${presentCount} participants are present, so the event has started before the scheduled time.`
          : `${presentCount} participants are present, so the event is ready before the scheduled start time.`,
        canShowLiveState,
        presentCount,
        acceptedCount,
        missingParticipants,
        leftParticipants,
        viewerPresence,
        hostPresent,
        minimumPresentCount,
        capacityLimit,
      });
    }

    if (hostRequired && hostPresent) {
      return createRuntimeStatus({
        status: canAutoStartBeforeScheduledTime || isManuallyActivated ? "active" : "ready",
        severity: "success",
        title: canAutoStartBeforeScheduledTime || isManuallyActivated ? "Event active" : "Event ready",
        message: canAutoStartBeforeScheduledTime || isManuallyActivated
          ? "The host is present, so the event has started before the scheduled time."
          : "The host is present, so the event is ready before the scheduled start time.",
        canShowLiveState,
        presentCount,
        acceptedCount,
        missingParticipants,
        leftParticipants,
        viewerPresence,
        hostPresent,
        minimumPresentCount,
        capacityLimit,
      });
    }

    return createRuntimeStatus({
      status: isInPreEventWindow ? "pre_event" : "not_started",
      severity: "neutral",
      title: isInPreEventWindow ? "Pre-event window" : "Not started yet",
      message: isInPreEventWindow
        ? "Presence tracking is available before the scheduled start time."
        : "Presence tracking is available, but the scheduled start time has not passed.",
      canShowLiveState,
      presentCount,
      acceptedCount,
      missingParticipants,
      leftParticipants,
      viewerPresence,
      hostPresent,
      minimumPresentCount,
      capacityLimit,
    });
  }

  if (minimumPresentCount && presentCount >= minimumPresentCount) {
    return createRuntimeStatus({
      status: isManualStartRequired ? "ready" : "active",
      severity: "success",
      title: isManualStartRequired ? "Event ready" : "Event active",
      message: isManualStartRequired
        ? `${presentCount} participants are present, so the event is ready for the host to start.`
        : `${presentCount} participants are present, so the event is active.`,
      canShowLiveState,
      presentCount,
      acceptedCount,
      missingParticipants,
      leftParticipants,
      viewerPresence,
      hostPresent,
      minimumPresentCount,
      capacityLimit,
    });
  }

  if (isManualStartRequired) {
    return createRuntimeStatus({
      status: "ready",
      severity: "success",
      title: "Event ready",
      message: "The configured conditions are met, and the host can start the event.",
      canShowLiveState,
      presentCount,
      acceptedCount,
      missingParticipants,
      leftParticipants,
      viewerPresence,
      hostPresent,
      minimumPresentCount,
      capacityLimit,
    });
  }

  return createRuntimeStatus({
    status: "active",
    severity: "success",
    title: "Event active",
    message: `${presentCount} participant${presentCount === 1 ? "" : "s"} currently marked present.`,
    canShowLiveState,
    presentCount,
    acceptedCount,
    missingParticipants,
    leftParticipants,
    viewerPresence,
    hostPresent,
    minimumPresentCount,
    capacityLimit,
  });
}

function createStatus(status: Omit<EventRuntimeStatus, "participants">, participants: EventPresencePerson[]): EventRuntimeStatus {
  return { ...status, participants };
}

function getDefaultTriggers(): EventTriggerRow[] {
  return [
    { type: "host_enters_area", enabled: true, config: { requireHostPresence: true, endWhenHostLeaves: false } },
    { type: "missing_after_start", enabled: true, config: { minutesAfterStart: DEFAULT_MISSING_AFTER_MINUTES } },
  ];
}

function hasTrigger(triggers: EventTriggerRow[], type: EventTriggerType) {
  return triggers.some((trigger) => trigger.type === type && trigger.enabled !== false);
}

function getMinimumPresentCount(triggers: EventTriggerRow[]) {
  const trigger = triggers.find((row) => row.type === "minimum_present" && row.enabled !== false);
  return trigger?.config ? readNumber(trigger.config, ["count", "minimum", "minimumPresentCount"]) : null;
}

function getHostPresenceRule(triggers: EventTriggerRow[]) {
  const trigger = triggers.find((row) => row.type === "host_enters_area" && row.enabled !== false);
  if (!trigger) {
    return { requireHostPresence: false, endWhenHostLeaves: false };
  }

  return {
    requireHostPresence: readBoolean(trigger.config, "requireHostPresence", true),
    endWhenHostLeaves: readBoolean(trigger.config, "endWhenHostLeaves", false),
  };
}

function getCapacityLimit(triggers: EventTriggerRow[]) {
  const trigger = triggers.find((row) => row.type === "capacity_warning" && row.enabled !== false);
  return trigger?.config ? readNumber(trigger.config, ["presentCount", "count", "capacity"]) : null;
}

function getMissingAfterMinutes(triggers: EventTriggerRow[]) {
  const trigger = triggers.find((row) => row.type === "missing_after_start" && row.enabled !== false);
  return trigger?.config ? readNumber(trigger.config, ["minutesAfterStart", "minutes", "delayMinutes"]) ?? DEFAULT_MISSING_AFTER_MINUTES : DEFAULT_MISSING_AFTER_MINUTES;
}

function readNumber(config: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return null;
}

function readBoolean(config: Record<string, unknown> | null, key: string, fallback: boolean) {
  if (!config || typeof config[key] !== "boolean") {
    return fallback;
  }

  return config[key];
}

function getPresenceState(input: {
  isInsideArea: boolean;
  hasCheckedIn: boolean;
  hasLiveLocation: boolean;
  hasFreshLocation: boolean;
}): EventPresencePerson["presenceState"] {
  if (input.isInsideArea) {
    return "present";
  }

  if (!input.hasCheckedIn) {
    return "not_arrived";
  }

  if (input.hasLiveLocation && input.hasFreshLocation) {
    return "left";
  }

  return "stale";
}

function hasEventCoordinates(event: EventItem) {
  return typeof event.latitude === "number" && typeof event.longitude === "number";
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

function fullNameFromProfile(profile: ProfileRow) {
  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  const fullName = `${first} ${last}`.trim();
  return fullName || profile.username?.trim() || "Unknown user";
}

function isMissingTriggerTableError(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || error?.message?.toLowerCase().includes("event_triggers") === true;
}
