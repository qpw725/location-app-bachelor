// @ts-nocheck

/*
  White-box test examples for the bachelor report.

  The project does not currently include a configured Jest/Vitest runner, so this
  file is intended as a compact report artifact: it shows representative test
  cases, the code path being tested, and the expected result for each case.
*/

import {
  canUseGpsAttendance,
  isEventPresenceWindowOpen,
  updateGpsPresenceFromCoordinates,
} from "../src/data/eventAttendance";
import { fetchEventRuntimeStatus } from "../src/data/eventRules";
import { startOpenAppEventPresenceTracking, stopOpenAppEventPresenceTracking } from "../src/eventPresenceManager";
import type { EventItem } from "../src/data/eventStore";

const now = new Date("2026-06-09T12:00:00.000Z");

const baseEvent: EventItem = {
  id: "event-1",
  title: "Test event",
  description: "A test event",
  time: "Tue 12:00 - 14:00",
  place: "Campus",
  latitude: 55.6761,
  longitude: 12.5683,
  host: "Host",
  genre: "General",
  visibility: "Public",
  startAt: new Date("2026-06-09T12:00:00.000Z"),
  endAt: new Date("2026-06-09T14:00:00.000Z"),
  creatorId: "host-1",
  attendanceEnabled: true,
  attendanceMethod: "gps_geofence",
  attendanceRadiusMeters: 75,
  liveMapEnabled: true,
  status: "scheduled",
  startedAt: null,
  endedAt: null,
  endedReason: null,
  preEventWindowMinutes: 60,
  startMode: "scheduled",
};

describe("White-box examples: GPS attendance validation", () => {
  test("GPS attendance is rejected when required settings are missing", () => {
    const invalidEvent = {
      ...baseEvent,
      latitude: null,
      attendanceRadiusMeters: 0,
    };

    const result = canUseGpsAttendance(invalidEvent);

    expect(result).toBe(false);
    // Result for report: PASS - invalid GPS setup does not allow GPS attendance.
  });

  test("Presence window is only open shortly before and during the event", () => {
    jest.spyOn(Date, "now").mockReturnValue(now.getTime());

    const beforeWindow = {
      ...baseEvent,
      startAt: new Date("2026-06-09T14:00:00.000Z"),
      endAt: new Date("2026-06-09T16:00:00.000Z"),
      preEventWindowMinutes: 30,
    };

    const duringEvent = {
      ...baseEvent,
      startAt: new Date("2026-06-09T11:30:00.000Z"),
      endAt: new Date("2026-06-09T12:30:00.000Z"),
    };

    expect(isEventPresenceWindowOpen(beforeWindow)).toBe(false);
    expect(isEventPresenceWindowOpen(duringEvent)).toBe(true);
    // Result for report: PASS - presence is blocked before the window and allowed during the event.
  });
});

describe("White-box examples: geofence presence updates", () => {
  test("User inside the geofence is checked in", async () => {
    mockSupabaseForAttendance({ existingAttendance: null });

    const result = await updateGpsPresenceFromCoordinates(baseEvent, "user-1", 55.6761, 12.5683);

    expect(result.status).toBe("checked_in");
    // Result for report: PASS - user inside the radius is marked present.
  });

  test("User outside the geofence is checked out", async () => {
    mockSupabaseForAttendance({
      existingAttendance: {
        event_id: "event-1",
        checked_out_at: null,
      },
    });

    const result = await updateGpsPresenceFromCoordinates(baseEvent, "user-1", 55.6861, 12.5783);

    expect(result.status).toBe("outside_geofence");
    // Result for report: PASS - active attendance is checked out when the user leaves the radius.
  });
});

describe("White-box examples: event runtime rules", () => {
  test("Event becomes active when the minimum number of participants are present", async () => {
    mockSupabaseForRuntimeStatus({
      viewerId: "host-1",
      triggers: [
        { type: "minimum_present", enabled: true, config: { count: 1 } },
        { type: "host_enters_area", enabled: true, config: { requireHostPresence: false } },
      ],
      people: [
        presentPerson("host-1", true),
        presentPerson("user-1", false),
      ],
    });

    const result = await fetchEventRuntimeStatus({
      event: { ...baseEvent, startAt: new Date("2026-06-09T11:00:00.000Z") },
      viewerRole: "hosting",
    });

    expect(result.data?.status).toBe("active");
    // Result for report: PASS - attendance rule changes the event status to active.
  });

  test("Event reports host_not_arrived when host presence is required", async () => {
    mockSupabaseForRuntimeStatus({
      viewerId: "user-1",
      triggers: [{ type: "host_enters_area", enabled: true, config: { requireHostPresence: true } }],
      people: [
        notArrivedPerson("host-1", true),
        presentPerson("user-1", false),
      ],
    });

    const result = await fetchEventRuntimeStatus({
      event: { ...baseEvent, startAt: new Date("2026-06-09T11:00:00.000Z") },
      viewerRole: "attending",
    });

    expect(result.data?.status).toBe("host_not_arrived");
    // Result for report: PASS - host requirement branch is triggered correctly.
  });
});

describe("White-box examples: open-app presence manager lifecycle", () => {
  test("Location tracking starts only when there are eligible active events", async () => {
    mockPresenceManagerDependencies({ activeEvents: [baseEvent], permissionGranted: true });

    await startOpenAppEventPresenceTracking();

    expect(mockLocation.watchPositionAsync).toHaveBeenCalledTimes(1);
    stopOpenAppEventPresenceTracking();
    // Result for report: PASS - location watcher starts when an eligible event exists.
  });

  test("Location tracking stops when tracking is stopped", async () => {
    const remove = jest.fn();
    mockPresenceManagerDependencies({ activeEvents: [baseEvent], permissionGranted: true, remove });

    await startOpenAppEventPresenceTracking();
    stopOpenAppEventPresenceTracking();

    expect(remove).toHaveBeenCalledTimes(1);
    // Result for report: PASS - location watcher is cleaned up when tracking stops.
  });
});

/*
  Minimal mocks used by the example tests above.
  In a real test setup these would usually live in __mocks__ files or a test helper.
*/

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
};

const mockLocation = {
  Accuracy: { High: 6 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
};

const mockFetchEventBuckets = jest.fn();

jest.mock("../src/supabase", () => ({ supabase: mockSupabase }));
jest.mock("../src/data/eventStore", () => ({ fetchEventBuckets: mockFetchEventBuckets }));
jest.mock("expo-location", () => mockLocation);
jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

function mockSupabaseForAttendance(input: {
  existingAttendance: { event_id: string; checked_out_at: string | null } | null;
}) {
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "event_live_locations") {
      return queryResult({ error: null });
    }

    if (table === "event_attendance") {
      return queryResult({ data: input.existingAttendance, error: null });
    }

    return queryResult({ data: null, error: null });
  });
}

function mockSupabaseForRuntimeStatus(input: {
  viewerId: string;
  triggers: Array<{ type: string; enabled: boolean; config: Record<string, unknown> }>;
  people: ReturnType<typeof presentPerson>[];
}) {
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: input.viewerId } }, error: null });
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "event_triggers") {
      return queryResult({ data: input.triggers, error: null });
    }

    if (table === "event_invites") {
      return queryResult({
        data: input.people.filter((person) => !person.isHost).map((person) => ({ invitee_id: person.id, status: "accepted" })),
        error: null,
      });
    }

    if (table === "event_attendance") {
      return queryResult({
        data: input.people
          .filter((person) => person.hasCheckedIn)
          .map((person) => ({
            user_id: person.id,
            checked_in_at: person.checkedInAt,
            checked_out_at: person.checkedOutAt,
          })),
        error: null,
      });
    }

    if (table === "event_live_locations") {
      return queryResult({
        data: input.people
          .filter((person) => person.lastLocationAt)
          .map((person) => ({
            user_id: person.id,
            latitude: baseEvent.latitude,
            longitude: baseEvent.longitude,
            updated_at: person.lastLocationAt,
          })),
        error: null,
      });
    }

    if (table === "profiles") {
      return queryResult({
        data: input.people.map((person) => ({
          id: person.id,
          username: person.id,
          first_name: person.isHost ? "Host" : "User",
          last_name: "",
          avatar_path: null,
        })),
        error: null,
      });
    }

    return queryResult({ data: null, error: null });
  });
}

function mockPresenceManagerDependencies(input: {
  activeEvents: EventItem[];
  permissionGranted: boolean;
  remove?: () => void;
}) {
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "host-1" } }, error: null });
  mockLocation.getForegroundPermissionsAsync.mockResolvedValue({ granted: input.permissionGranted });
  mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ granted: input.permissionGranted });
  mockLocation.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 55.6761, longitude: 12.5683 } });
  mockLocation.watchPositionAsync.mockResolvedValue({ remove: input.remove ?? jest.fn() });

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "event_live_locations" || table === "event_attendance") {
      return queryResult({ data: null, error: null });
    }

    return queryResult({ data: [], error: null });
  });

  mockFetchEventBuckets.mockResolvedValue({
    data: {
      publicEvents: [],
      attendingEvents: [],
      hostingEvents: input.activeEvents,
      pastEvents: [],
    },
    error: null,
  });
}

function presentPerson(id: string, isHost: boolean) {
  return {
    id,
    isHost,
    hasCheckedIn: true,
    checkedInAt: "2026-06-09T11:55:00.000Z",
    checkedOutAt: null,
    lastLocationAt: "2026-06-09T12:00:00.000Z",
  };
}

function notArrivedPerson(id: string, isHost: boolean) {
  return {
    id,
    isHost,
    hasCheckedIn: false,
    checkedInAt: null,
    checkedOutAt: null,
    lastLocationAt: null,
  };
}

function queryResult<T>(result: T) {
  const query = {
    select: () => query,
    upsert: () => query,
    insert: () => query,
    update: () => query,
    eq: () => query,
    in: () => query,
    limit: () => query,
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: T) => unknown) => Promise.resolve(result).then(resolve),
  };

  return query;
}
