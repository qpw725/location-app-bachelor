import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { stopSharingMyEventLocation, upsertMyEventLiveLocation } from "./data/eventLiveLocation";

const STORAGE_KEY = "active_event_location_shares";
const BACKGROUND_LOCATION_TASK = "event-live-location-background-task";

type ActiveEventShare = {
  eventId: string;
  startAtIso: string | null;
  endAtIso: string | null;
};

type BackgroundLocationTaskPayload = {
  locations?: Array<{
    coords: {
      latitude: number;
      longitude: number;
    };
  }>;
};

let initializePromise: Promise<void> | null = null;
let foregroundLocationSubscription: Location.LocationSubscription | null = null;
let pruneTimer: ReturnType<typeof setInterval> | null = null;

function getEventEndMs(share: ActiveEventShare) {
  const fallback = share.startAtIso ? new Date(share.startAtIso).getTime() : NaN;
  return share.endAtIso ? new Date(share.endAtIso).getTime() : fallback;
}

function isShareActive(share: ActiveEventShare) {
  const endMs = getEventEndMs(share);
  return Number.isFinite(endMs) ? endMs >= Date.now() : true;
}

async function loadActiveShares() {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored ? ((JSON.parse(stored) as ActiveEventShare[]) ?? []) : [];
}

async function saveActiveShares(shares: ActiveEventShare[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(shares));
}

async function stopBackgroundLocationUpdatesIfIdle(shares: ActiveEventShare[]) {
  if (shares.length > 0) {
    return;
  }

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}

async function stopForegroundLocationUpdatesIfIdle(shares: ActiveEventShare[]) {
  if (shares.length > 0) {
    return;
  }

  foregroundLocationSubscription?.remove();
  foregroundLocationSubscription = null;

  if (pruneTimer) {
    clearInterval(pruneTimer);
    pruneTimer = null;
  }
}

async function pruneExpiredShares() {
  const currentShares = await loadActiveShares();
  const activeShares = currentShares.filter((share) => isShareActive(share));
  const expiredShares = currentShares.filter((share) => !isShareActive(share));

  if (expiredShares.length === 0) {
    return activeShares;
  }

  await saveActiveShares(activeShares);

  for (const share of expiredShares) {
    const { error } = await stopSharingMyEventLocation(share.eventId);
    if (error) {
      console.warn(`[LocationSharing] Failed to stop expired share ${share.eventId}:`, error);
    }
  }

  await stopBackgroundLocationUpdatesIfIdle(activeShares);
  await stopForegroundLocationUpdatesIfIdle(activeShares);
  return activeShares;
}

async function broadcastLocation(latitude: number, longitude: number) {
  const activeShares = await pruneExpiredShares();

  for (const share of activeShares) {
    const { error } = await upsertMyEventLiveLocation({
      eventId: share.eventId,
      latitude,
      longitude,
    });

    if (error) {
      console.warn(`[LocationSharing] Failed to update ${share.eventId}:`, error);
    }
  }
}

async function ensureBackgroundLocationUpdatesRunning() {
  const activeShares = await pruneExpiredShares();
  if (activeShares.length === 0) {
    return;
  }

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (hasStarted) {
    return;
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15000,
    distanceInterval: 25,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Event location sharing is active",
      notificationBody: "Your location is being shared for an active event until you stop it or the event ends.",
      notificationColor: "#1f4fa3",
    },
  });
}

async function ensureForegroundLocationUpdatesRunning() {
  const activeShares = await pruneExpiredShares();
  if (activeShares.length === 0 || foregroundLocationSubscription) {
    return;
  }

  const foregroundPermission = await Location.getForegroundPermissionsAsync();
  if (!foregroundPermission.granted) {
    return;
  }

  foregroundLocationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15000,
      distanceInterval: 25,
    },
    (position) => {
      void broadcastLocation(position.coords.latitude, position.coords.longitude);
    }
  );

  if (!pruneTimer) {
    pruneTimer = setInterval(() => {
      void pruneExpiredShares();
    }, 60000);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race<T | null>([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

async function enableBackgroundLocationBestEffort() {
  try {
    const backgroundPermission = await withTimeout(Location.requestBackgroundPermissionsAsync(), 5000);
    if (!backgroundPermission?.granted) {
      return;
    }

    await withTimeout(ensureBackgroundLocationUpdatesRunning(), 5000);
  } catch (error) {
    console.warn("[LocationSharing] Background mode unavailable, continuing with foreground tracking:", error);
  }
}

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.warn("[LocationSharing] Background location task error:", error.message);
      return;
    }

    const payload = data as BackgroundLocationTaskPayload | undefined;
    const latestLocation = payload?.locations?.[payload.locations.length - 1];

    if (!latestLocation) {
      await pruneExpiredShares();
      return;
    }

    await broadcastLocation(latestLocation.coords.latitude, latestLocation.coords.longitude);
  });
}

export async function initializeEventLocationSharing() {
  if (initializePromise) {
    return initializePromise;
  }

  initializePromise = (async () => {
    await pruneExpiredShares();
    await ensureForegroundLocationUpdatesRunning();
    await enableBackgroundLocationBestEffort();
  })();

  try {
    await initializePromise;
  } finally {
    initializePromise = null;
  }
}

export async function startEventLocationSharing(input: {
  eventId: string;
  startAt: Date | null;
  endAt: Date | null;
}) {
  await initializeEventLocationSharing();

  const foregroundPermission = await Location.requestForegroundPermissionsAsync();
  if (!foregroundPermission.granted) {
    return { error: "Foreground location permission is required to share your location on the event map." };
  }

  const currentShares = await loadActiveShares();
  const nextShare: ActiveEventShare = {
    eventId: input.eventId,
    startAtIso: input.startAt?.toISOString() ?? null,
    endAtIso: input.endAt?.toISOString() ?? null,
  };

  const nextShares = currentShares.filter((share) => share.eventId !== input.eventId).concat(nextShare);
  await saveActiveShares(nextShares);

  const currentPosition = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const { error: firstUpsertError } = await upsertMyEventLiveLocation({
    eventId: input.eventId,
    latitude: currentPosition.coords.latitude,
    longitude: currentPosition.coords.longitude,
  });

  if (firstUpsertError) {
    return { error: firstUpsertError };
  }

  await ensureForegroundLocationUpdatesRunning();
  void enableBackgroundLocationBestEffort();

  return { error: null };
}

export async function stopEventLocationSharing(eventId: string) {
  await initializeEventLocationSharing();

  const currentShares = await loadActiveShares();
  const nextShares = currentShares.filter((share) => share.eventId !== eventId);
  await saveActiveShares(nextShares);
  await stopBackgroundLocationUpdatesIfIdle(nextShares);
  await stopForegroundLocationUpdatesIfIdle(nextShares);

  return stopSharingMyEventLocation(eventId);
}
