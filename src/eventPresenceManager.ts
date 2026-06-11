import { Alert, AppState, type AppStateStatus, type NativeEventSubscription } from "react-native";
import * as Location from "expo-location";
import {
  canUseGpsAttendance,
  isEventPresenceWindowOpen,
  updateGpsPresenceFromCoordinates,
} from "./data/eventAttendance";
import { endHostedEventNow, fetchEventRuntimeStatus } from "./data/eventRules";
import { fetchEventBuckets, type EventItem } from "./data/eventStore";
import { supabase } from "./supabase";

const REFRESH_INTERVAL_MS = 60 * 1000;
const LOCATION_UPDATE_INTERVAL_MS = 10 * 1000;
const LOCATION_DISTANCE_INTERVAL_METERS = 10;

let activeEvents: EventItem[] = [];
let activeUserId: string | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let locationSubscription: Location.LocationSubscription | null = null;
let appStateSubscription: NativeEventSubscription | null = null;
let startPromise: Promise<void> | null = null;
let isStarted = false;
const missingReminderEventIds = new Set<string>();
const capacityWarningEventIds = new Set<string>();
const endedByHostLeaveEventIds = new Set<string>();
const hostArrivedReminderEventIds = new Set<string>();
const hostLeftReminderEventIds = new Set<string>();
const minimumMissingReminderEventIds = new Set<string>();
const attendeeCapacityReminderEventIds = new Set<string>();

type PresenceEventSnapshot = {
  activePresenceEvents: EventItem[];
  attendingEvents: EventItem[];
  hostingEvents: EventItem[];
};

function dedupeEvents(events: EventItem[]) {
  const byId = new Map<string, EventItem>();
  for (const event of events) {
    byId.set(event.id, event);
  }

  return Array.from(byId.values());
}

function getEligiblePresenceEvents(events: EventItem[]) {
  return dedupeEvents(events).filter(
    (event) => (canUseGpsAttendance(event) || canUseLiveMapLocation(event)) && isEventPresenceWindowOpen(event)
  );
}

function canUseLiveMapLocation(event: EventItem) {
  return event.liveMapEnabled && typeof event.latitude === "number" && typeof event.longitude === "number";
}

async function upsertLiveMapLocation(eventId: string, userId: string, latitude: number, longitude: number) {
  const { error } = await supabase.from("event_live_locations").upsert(
    [
      {
        event_id: eventId,
        user_id: userId,
        latitude,
        longitude,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "event_id,user_id" }
  );

  if (error) {
    console.warn(`[EventPresence] Failed to update live map for ${eventId}:`, error.message);
  }
}

async function fetchEligiblePresenceEvents(): Promise<PresenceEventSnapshot | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.warn("[EventPresence] Could not identify current user:", authError.message);
    return null;
  }

  if (!user) {
    return null;
  }

  const { data, error } = await fetchEventBuckets();
  if (error || !data) {
    console.warn("[EventPresence] Could not load presence events:", error);
    return null;
  }

  activeUserId = user.id;
  return {
    activePresenceEvents: getEligiblePresenceEvents([...data.attendingEvents, ...data.hostingEvents]),
    attendingEvents: data.attendingEvents,
    hostingEvents: data.hostingEvents,
  };
}

async function updatePresenceForPosition(latitude: number, longitude: number) {
  if (!activeUserId || activeEvents.length === 0) {
    return;
  }

  const events = activeEvents;
  for (const event of events) {
    if (canUseGpsAttendance(event)) {
      const result = await updateGpsPresenceFromCoordinates(event, activeUserId, latitude, longitude);
      if (result.status === "error") {
        console.warn(`[EventPresence] Failed to update ${event.id}:`, result.reason);
      }
    } else if (canUseLiveMapLocation(event)) {
      await upsertLiveMapLocation(event.id, activeUserId, latitude, longitude);
    }

    if (canUseGpsAttendance(event) && event.creatorId === activeUserId) {
      await maybeEndEventAfterHostLeft(event);
    }
  }
}

async function maybeEndEventAfterHostLeft(event: EventItem) {
  if (!activeUserId || event.creatorId !== activeUserId || endedByHostLeaveEventIds.has(event.id)) {
    return;
  }

  const { data: status, error } = await fetchEventRuntimeStatus({ event, viewerRole: "hosting" });
  if (error) {
    console.warn(`[EventPresence] Could not evaluate host-leave end for ${event.id}:`, error);
    return;
  }

  if (status?.status !== "ended" || !status.endedByHostLeaving) {
    return;
  }

  const { error: endError } = await endHostedEventNow(event.id);
  if (endError) {
    console.warn(`[EventPresence] Could not end ${event.id} after host left:`, endError);
    return;
  }

  endedByHostLeaveEventIds.add(event.id);
}

async function maybeNotifyMissingParticipants(events: EventItem[]) {
  if (!activeUserId) {
    return;
  }

  const eligibleEvents = getEligiblePresenceEvents(events);
  for (const event of eligibleEvents) {
    if (missingReminderEventIds.has(event.id)) {
      continue;
    }

    const { data: status, error } = await fetchEventRuntimeStatus({ event, viewerRole: "attending" });
    if (error) {
      console.warn(`[EventPresence] Could not evaluate missing reminder for ${event.id}:`, error);
      continue;
    }

    const viewerIsMissing = status?.missingParticipants.some((participant) => participant.id === activeUserId) === true;
    if (!viewerIsMissing) {
      continue;
    }

    missingReminderEventIds.add(event.id);
    Alert.alert(
      "You are not present",
      `You are not marked present for "${event.title}" yet. Keep the app open near the event area so your presence can update.`
    );
  }
}

function viewerIsMissingOrInactive(status: NonNullable<Awaited<ReturnType<typeof fetchEventRuntimeStatus>>["data"]>) {
  return (
    status.viewerPresence?.presenceState === "not_arrived" ||
    status.viewerPresence?.presenceState === "inactive"
  );
}

async function maybeNotifyAttendeeEventRules(events: EventItem[]) {
  if (!activeUserId) {
    return;
  }

  const eligibleEvents = getEligiblePresenceEvents(events);
  for (const event of eligibleEvents) {
    const { data: status, error } = await fetchEventRuntimeStatus({ event, viewerRole: "attending" });
    if (error || !status) {
      if (error) {
        console.warn(`[EventPresence] Could not evaluate attendee rule notifications for ${event.id}:`, error);
      }
      continue;
    }

    if (
      status.hostPresenceRequired &&
      status.hostPresent &&
      !status.viewerPresence?.isHost &&
      !hostArrivedReminderEventIds.has(event.id)
    ) {
      hostArrivedReminderEventIds.add(event.id);
      Alert.alert("Host arrived", `The host has arrived to "${event.title}", and the event may now begin properly.`);
    }

    if (
      status.endedByHostLeaving &&
      viewerIsMissingOrInactive(status) &&
      !hostLeftReminderEventIds.has(event.id)
    ) {
      hostLeftReminderEventIds.add(event.id);
      Alert.alert("Event ended", `"${event.title}" has now ended because the host left the event area.`);
    }

    const startMs = event.startAt?.getTime() ?? NaN;
    const hasStarted = !Number.isFinite(startMs) || Date.now() >= startMs;
    if (
      hasStarted &&
      status.status === "not_enough_participants" &&
      viewerIsMissingOrInactive(status) &&
      !minimumMissingReminderEventIds.has(event.id)
    ) {
      minimumMissingReminderEventIds.add(event.id);
      Alert.alert(
        "Not enough participants",
        `You are not present for "${event.title}" yet. Please go there, because there are not enough participants present.`
      );
    }

    if (
      status.status === "event_full" &&
      viewerIsMissingOrInactive(status) &&
      !attendeeCapacityReminderEventIds.has(event.id)
    ) {
      attendeeCapacityReminderEventIds.add(event.id);
      Alert.alert("Event nearly full", `You are registered for "${event.title}", but it is nearly full.`);
    }
  }
}

async function maybeNotifyCapacityWarnings(events: EventItem[]) {
  const eligibleEvents = getEligiblePresenceEvents(events);
  for (const event of eligibleEvents) {
    if (capacityWarningEventIds.has(event.id)) {
      continue;
    }

    const { data: status, error } = await fetchEventRuntimeStatus({ event, viewerRole: "hosting" });
    if (error) {
      console.warn(`[EventPresence] Could not evaluate capacity warning for ${event.id}:`, error);
      continue;
    }

    if (status?.status !== "event_full") {
      continue;
    }

    capacityWarningEventIds.add(event.id);
    Alert.alert("Capacity reached", `"${event.title}" has reached the configured present-participant limit.`);
  }
}

async function stopLocationUpdatesIfIdle() {
  if (activeEvents.length > 0) {
    return;
  }

  locationSubscription?.remove();
  locationSubscription = null;
}

async function ensureLocationUpdatesRunning() {
  if (activeEvents.length === 0) {
    return;
  }

  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) {
    permission = await Location.requestForegroundPermissionsAsync();
  }

  if (!permission.granted) {
    console.warn("[EventPresence] Foreground location permission was not granted.");
    return;
  }

  if (!locationSubscription) {
    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: LOCATION_UPDATE_INTERVAL_MS,
        distanceInterval: LOCATION_DISTANCE_INTERVAL_METERS,
      },
      (position) => {
        void updatePresenceForPosition(position.coords.latitude, position.coords.longitude);
      }
    );
  }

  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    await updatePresenceForPosition(position.coords.latitude, position.coords.longitude);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not read current location.";
    console.warn("[EventPresence] Could not read initial position:", message);
  }
}

async function refreshPresenceTracking() {
  const snapshot = await fetchEligiblePresenceEvents();
  if (!snapshot) {
    activeEvents = [];
    activeUserId = null;
    await stopLocationUpdatesIfIdle();
    return;
  }

  activeEvents = snapshot.activePresenceEvents;
  await stopLocationUpdatesIfIdle();
  await ensureLocationUpdatesRunning();
  await maybeNotifyMissingParticipants(snapshot.attendingEvents);
  await maybeNotifyAttendeeEventRules(snapshot.attendingEvents);
  await maybeNotifyCapacityWarnings(snapshot.hostingEvents);
}

function handleAppStateChange(state: AppStateStatus) {
  if (!isStarted) {
    return;
  }

  if (state === "active") {
    void refreshPresenceTracking();
    return;
  }

  activeEvents = [];
  locationSubscription?.remove();
  locationSubscription = null;
}

export async function startOpenAppEventPresenceTracking() {
  isStarted = true;

  if (startPromise) {
    return startPromise;
  }

  startPromise = (async () => {
    await refreshPresenceTracking();

    if (!refreshTimer) {
      refreshTimer = setInterval(() => {
        void refreshPresenceTracking();
      }, REFRESH_INTERVAL_MS);
    }

    if (!appStateSubscription) {
      appStateSubscription = AppState.addEventListener("change", handleAppStateChange);
    }
  })();

  try {
    await startPromise;
  } finally {
    startPromise = null;
  }
}

export function stopOpenAppEventPresenceTracking() {
  isStarted = false;
  activeEvents = [];
  activeUserId = null;
  missingReminderEventIds.clear();
  capacityWarningEventIds.clear();
  endedByHostLeaveEventIds.clear();
  hostArrivedReminderEventIds.clear();
  hostLeftReminderEventIds.clear();
  minimumMissingReminderEventIds.clear();
  attendeeCapacityReminderEventIds.clear();

  locationSubscription?.remove();
  locationSubscription = null;

  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  appStateSubscription?.remove();
  appStateSubscription = null;
}
