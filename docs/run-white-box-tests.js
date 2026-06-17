const fs = require("fs");
const path = require("path");
const Module = require("module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;

  module._compile(output, filename);
};

const tests = [];
const realDateNow = Date.now;
const fixedNow = new Date("2026-06-09T12:00:00.000Z").getTime();

function test(name, fn) {
  tests.push({ name, fn });
}

function expectEqual(actual, expected) {
  if (!Object.is(actual, expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function createMockFn(implementation = () => undefined) {
  const fn = (...args) => {
    fn.calls.push(args);
    return fn.implementation(...args);
  };

  fn.calls = [];
  fn.implementation = implementation;
  fn.setImplementation = (nextImplementation) => {
    fn.implementation = nextImplementation;
  };
  fn.setResolvedValue = (value) => {
    fn.implementation = () => Promise.resolve(value);
  };
  fn.clear = () => {
    fn.calls = [];
  };

  return fn;
}

const mockSupabase = {
  auth: {
    getUser: createMockFn(),
  },
  from: createMockFn(),
  storage: {
    from: () => ({
      getPublicUrl: (avatarPath) => ({ data: { publicUrl: `https://example.test/${avatarPath}` } }),
    }),
  },
};

const mockLocation = {
  Accuracy: { High: 6 },
  getForegroundPermissionsAsync: createMockFn(),
  requestForegroundPermissionsAsync: createMockFn(),
  getCurrentPositionAsync: createMockFn(),
  watchPositionAsync: createMockFn(),
};

const mockAlert = {
  alert: createMockFn(),
};

const mockAppState = {
  addEventListener: createMockFn(() => ({ remove: createMockFn() })),
};

const mockFetchEventBuckets = createMockFn();

const originalLoad = Module._load;
Module._load = function patchedModuleLoad(request, parent, isMain) {
  if (request === "expo-location") {
    return mockLocation;
  }

  if (request === "expo-image-picker") {
    return {};
  }

  if (request === "react-native") {
    return { Alert: mockAlert, AppState: mockAppState };
  }

  const resolved = Module._resolveFilename(request, parent, isMain);
  if (resolved.endsWith(path.join("src", "supabase.ts"))) {
    return { supabase: mockSupabase };
  }

  if (resolved.endsWith(path.join("src", "data", "eventStore.ts"))) {
    return { fetchEventBuckets: mockFetchEventBuckets };
  }

  return originalLoad.apply(this, arguments);
};

const {
  canUseGpsAttendance,
  isEventPresenceWindowOpen,
  updateGpsPresenceFromCoordinates,
} = require("../src/data/eventAttendance.ts");
const { fetchEventRuntimeStatus } = require("../src/data/eventRules.ts");
const {
  startOpenAppEventPresenceTracking,
  stopOpenAppEventPresenceTracking,
} = require("../src/eventPresenceManager.ts");

const baseEvent = {
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

let scenario = {};

function resetMocks() {
  Date.now = () => fixedNow;
  scenario = {};
  mockSupabase.auth.getUser.clear();
  mockSupabase.from.clear();
  mockLocation.getForegroundPermissionsAsync.clear();
  mockLocation.requestForegroundPermissionsAsync.clear();
  mockLocation.getCurrentPositionAsync.clear();
  mockLocation.watchPositionAsync.clear();
  mockAlert.alert.clear();
  mockAppState.addEventListener.clear();
  mockFetchEventBuckets.clear();
  mockSupabase.from.setImplementation((table) => createQuery(table));
}

function createQuery(table) {
  const query = {
    select: () => query,
    upsert: () => query,
    insert: () => query,
    update: () => query,
    eq: () => query,
    in: () => query,
    limit: () => query,
    maybeSingle: () => Promise.resolve(resultForTable(table, true)),
    then: (resolve, reject) => Promise.resolve(resultForTable(table, false)).then(resolve, reject),
  };

  return query;
}

function resultForTable(table, single) {
  if (table === "event_live_locations") {
    if (scenario.runtime) {
      return {
        data: scenario.runtime.people
          .filter((person) => person.lastLocationAt)
          .map((person) => ({
            user_id: person.id,
            latitude: baseEvent.latitude,
            longitude: baseEvent.longitude,
            updated_at: person.lastLocationAt,
          })),
        error: null,
      };
    }

    return { data: null, error: null };
  }

  if (table === "event_attendance") {
    if (scenario.runtime) {
      return {
        data: scenario.runtime.people
          .filter((person) => person.hasCheckedIn)
          .map((person) => ({
            user_id: person.id,
            checked_in_at: person.checkedInAt,
            checked_out_at: person.checkedOutAt,
          })),
        error: null,
      };
    }

    if (single) {
      return { data: scenario.existingAttendance ?? null, error: null };
    }

    return { data: null, error: null };
  }

  if (table === "event_triggers") {
    return { data: scenario.runtime?.triggers ?? [], error: null };
  }

  if (table === "event_invites") {
    return {
      data:
        scenario.runtime?.people
          ?.filter((person) => !person.isHost)
          .map((person) => ({ invitee_id: person.id, status: "accepted" })) ?? [],
      error: null,
    };
  }

  if (table === "profiles") {
    return {
      data:
        scenario.runtime?.people?.map((person) => ({
          id: person.id,
          username: person.id,
          first_name: person.isHost ? "Host" : "User",
          last_name: "",
          avatar_path: null,
        })) ?? [],
      error: null,
    };
  }

  return { data: null, error: null };
}

function mockSupabaseForAttendance(existingAttendance) {
  scenario = { existingAttendance };
}

function mockSupabaseForRuntimeStatus(input) {
  scenario = { runtime: input };
  mockSupabase.auth.getUser.setResolvedValue({ data: { user: { id: input.viewerId } }, error: null });
}

function mockPresenceManagerDependencies(input) {
  scenario = { existingAttendance: null };
  mockSupabase.auth.getUser.setResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  mockFetchEventBuckets.setResolvedValue({
    data: {
      publicEvents: [],
      attendingEvents: input.activeEvents,
      hostingEvents: [],
      pastEvents: [],
    },
    error: null,
  });
  mockLocation.getForegroundPermissionsAsync.setResolvedValue({ granted: input.permissionGranted });
  mockLocation.requestForegroundPermissionsAsync.setResolvedValue({ granted: input.permissionGranted });
  mockLocation.getCurrentPositionAsync.setResolvedValue({ coords: { latitude: 55.6761, longitude: 12.5683 } });
  mockLocation.watchPositionAsync.setResolvedValue({ remove: input.remove ?? createMockFn() });
}

function presentPerson(id, isHost) {
  return {
    id,
    isHost,
    hasCheckedIn: true,
    checkedInAt: "2026-06-09T11:55:00.000Z",
    checkedOutAt: null,
    lastLocationAt: "2026-06-09T12:00:00.000Z",
  };
}

function notArrivedPerson(id, isHost) {
  return {
    id,
    isHost,
    hasCheckedIn: false,
    checkedInAt: null,
    checkedOutAt: null,
    lastLocationAt: null,
  };
}

test("GPS attendance is rejected when required settings are missing", () => {
  const invalidEvent = { ...baseEvent, latitude: null, attendanceRadiusMeters: 0 };
  expectEqual(canUseGpsAttendance(invalidEvent), false);
});

test("Presence window is only open shortly before and during the event", () => {
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

  expectEqual(isEventPresenceWindowOpen(beforeWindow), false);
  expectEqual(isEventPresenceWindowOpen(duringEvent), true);
});

test("User inside the geofence is checked in", async () => {
  mockSupabaseForAttendance(null);
  const result = await updateGpsPresenceFromCoordinates(baseEvent, "user-1", 55.6761, 12.5683);
  expectEqual(result.status, "checked_in");
});

test("User outside the geofence is checked out", async () => {
  mockSupabaseForAttendance({ event_id: "event-1", checked_out_at: null });
  const result = await updateGpsPresenceFromCoordinates(baseEvent, "user-1", 55.6861, 12.5783);
  expectEqual(result.status, "outside_geofence");
});

test("Event becomes active when the minimum number of participants are present", async () => {
  mockSupabaseForRuntimeStatus({
    viewerId: "host-1",
    triggers: [
      { type: "minimum_present", enabled: true, config: { count: 1 } },
      { type: "host_enters_area", enabled: true, config: { requireHostPresence: false } },
    ],
    people: [presentPerson("host-1", true), presentPerson("user-1", false)],
  });

  const result = await fetchEventRuntimeStatus({
    event: { ...baseEvent, startAt: new Date("2026-06-09T11:00:00.000Z") },
    viewerRole: "hosting",
  });

  expectEqual(result.data.status, "active");
});

test("Event reports host_not_arrived when host presence is required", async () => {
  mockSupabaseForRuntimeStatus({
    viewerId: "user-1",
    triggers: [{ type: "host_enters_area", enabled: true, config: { requireHostPresence: true } }],
    people: [notArrivedPerson("host-1", true), presentPerson("user-1", false)],
  });

  const result = await fetchEventRuntimeStatus({
    event: { ...baseEvent, startAt: new Date("2026-06-09T11:00:00.000Z") },
    viewerRole: "attending",
  });

  expectEqual(result.data.status, "host_not_arrived");
});

test("Location tracking starts only when there are eligible active events", async () => {
  mockPresenceManagerDependencies({ activeEvents: [baseEvent], permissionGranted: true });
  await startOpenAppEventPresenceTracking();
  expectEqual(mockLocation.watchPositionAsync.calls.length, 1);
  stopOpenAppEventPresenceTracking();
});

test("Location tracking stops when tracking is stopped", async () => {
  const remove = createMockFn();
  mockPresenceManagerDependencies({ activeEvents: [baseEvent], permissionGranted: true, remove });
  await startOpenAppEventPresenceTracking();
  stopOpenAppEventPresenceTracking();
  expectEqual(remove.calls.length, 1);
});

(async () => {
  let passed = 0;

  for (const { name, fn } of tests) {
    resetMocks();

    try {
      await fn();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    } finally {
      stopOpenAppEventPresenceTracking();
    }
  }

  Date.now = realDateNow;
  console.log(`\nResult: ${passed}/${tests.length} tests passed.`);
})();
