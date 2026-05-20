import { AppState, type AppStateStatus, type NativeEventSubscription } from "react-native";
import * as Location from "expo-location";
import {
  canUseGpsAttendance,
  isEventPresenceWindowOpen,
  updateGpsPresenceFromCoordinates,
} from "./data/eventAttendance";
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
let hasRequestedLocationPermission = false;

function dedupeEvents(events: EventItem[]) {
  const byId = new Map<string, EventItem>();
  for (const event of events) {
    byId.set(event.id, event);
  }

  return Array.from(byId.values());
}

function getEligiblePresenceEvents(events: EventItem[]) {
  return dedupeEvents(events).filter((event) => canUseGpsAttendance(event) && isEventPresenceWindowOpen(event));
}

async function fetchEligiblePresenceEvents() {
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
  return getEligiblePresenceEvents([...data.attendingEvents, ...data.hostingEvents]);
}

async function updatePresenceForPosition(latitude: number, longitude: number) {
  if (!activeUserId || activeEvents.length === 0) {
    return;
  }

  const events = activeEvents;
  for (const event of events) {
    const result = await updateGpsPresenceFromCoordinates(event, activeUserId, latitude, longitude);
    if (result.status === "error") {
      console.warn(`[EventPresence] Failed to update ${event.id}:`, result.reason);
    }
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
  if (activeEvents.length === 0 || locationSubscription) {
    return;
  }

  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted && !hasRequestedLocationPermission) {
    hasRequestedLocationPermission = true;
    permission = await Location.requestForegroundPermissionsAsync();
  }

  if (!permission.granted) {
    console.warn("[EventPresence] Foreground location permission was not granted.");
    return;
  }

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

  Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    .then((position) => updatePresenceForPosition(position.coords.latitude, position.coords.longitude))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Could not read current location.";
      console.warn("[EventPresence] Could not read initial position:", message);
    });
}

async function refreshPresenceTracking() {
  const eligibleEvents = await fetchEligiblePresenceEvents();
  if (!eligibleEvents) {
    activeEvents = [];
    activeUserId = null;
    await stopLocationUpdatesIfIdle();
    return;
  }

  activeEvents = eligibleEvents;
  await stopLocationUpdatesIfIdle();
  await ensureLocationUpdatesRunning();
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
  hasRequestedLocationPermission = false;

  locationSubscription?.remove();
  locationSubscription = null;

  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  appStateSubscription?.remove();
  appStateSubscription = null;
}
