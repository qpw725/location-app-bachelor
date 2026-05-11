import { PermissionsAndroid, Platform } from "react-native";
import BleAdvertise from "react-native-ble-advertise";
import { BleManager, type Device } from "react-native-ble-plx";
import type { EventItem } from "./eventStore";
import { isEventOngoing } from "./eventAttendance";
import { supabase } from "../supabase";

const APP_BEACON_UUID = "44c13e43-097a-9c9f-537f-5666a6840c08";
const ANDROID_COMPANY_ID = 0x00e0;
const BLE_SCAN_TIMEOUT_MS = 12000;

const bleManager = new BleManager();

export type BleAttendanceResult =
  | { status: "checked_in"; rssi: number | null }
  | { status: "already_checked_in" }
  | { status: "beacon_not_found" }
  | { status: "not_available"; reason: string }
  | { status: "error"; reason: string };

export type HostBeaconResult =
  | { status: "started"; major: number; minor: number }
  | { status: "stopped" }
  | { status: "not_available"; reason: string }
  | { status: "error"; reason: string };

type BeaconIdentity = {
  uuid: string;
  major: number;
  minor: number;
};

export function canUseBleAttendance(event: EventItem) {
  return event.attendanceEnabled && event.attendanceMethod === "ble_beacon";
}

export function getEventBeaconIdentity(eventId: string): BeaconIdentity {
  const hash = hashEventId(eventId);
  return {
    uuid: APP_BEACON_UUID,
    major: (hash >>> 16) & 0xffff,
    minor: hash & 0xffff,
  };
}

export async function startHostBleBeacon(event: EventItem): Promise<HostBeaconResult> {
  if (!canUseBleAttendance(event)) {
    return { status: "not_available", reason: "This event is not using Bluetooth attendance." };
  }

  if (!isEventOngoing(event)) {
    return { status: "not_available", reason: "The Bluetooth beacon can only run while the event is ongoing." };
  }

  const hasPermission = await requestBleAdvertisePermissions();
  if (!hasPermission) {
    return { status: "not_available", reason: "Bluetooth permission is needed to start the event beacon." };
  }

  const identity = getEventBeaconIdentity(event.id);

  try {
    if (Platform.OS === "android") {
      BleAdvertise.setCompanyId(ANDROID_COMPANY_ID);
    }

    await BleAdvertise.broadcast(identity.uuid, identity.major, identity.minor);
    return { status: "started", major: identity.major, minor: identity.minor };
  } catch (error: unknown) {
    return { status: "error", reason: getErrorMessage(error) };
  }
}

export async function stopHostBleBeacon(): Promise<HostBeaconResult> {
  try {
    await BleAdvertise.stopBroadcast();
    return { status: "stopped" };
  } catch (error: unknown) {
    return { status: "error", reason: getErrorMessage(error) };
  }
}

export async function autoCheckInWithBleBeacon(event: EventItem): Promise<BleAttendanceResult> {
  if (!canUseBleAttendance(event)) {
    return { status: "not_available", reason: "This event is not using Bluetooth attendance." };
  }

  if (!isEventOngoing(event)) {
    return { status: "not_available", reason: "Attendance is only counted while the event is ongoing." };
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

  const hasPermission = await requestBleScanPermissions();
  if (!hasPermission) {
    return { status: "not_available", reason: "Bluetooth permission is needed to count attendance." };
  }

  const scanResult = await scanForEventBeacon(event.id);
  if (scanResult.status !== "found") {
    return scanResult.status === "error"
      ? { status: "error", reason: scanResult.reason }
      : { status: "beacon_not_found" };
  }

  const { error: insertError } = await supabase.from("event_attendance").upsert(
    [
      {
        event_id: event.id,
        user_id: user.id,
        checked_in_at: new Date().toISOString(),
        method: "ble_beacon",
      },
    ],
    { onConflict: "event_id,user_id" }
  );

  if (insertError) {
    return { status: "error", reason: insertError.message };
  }

  return { status: "checked_in", rssi: scanResult.rssi };
}

async function requestBleScanPermissions() {
  if (Platform.OS !== "android") {
    return true;
  }

  const permissions =
    Platform.Version >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const result = await PermissionsAndroid.requestMultiple(permissions);
  return Object.values(result).every((value) => value === PermissionsAndroid.RESULTS.GRANTED);
}

async function requestBleAdvertisePermissions() {
  if (Platform.OS !== "android") {
    return true;
  }

  const permissions =
    Platform.Version >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const result = await PermissionsAndroid.requestMultiple(permissions);
  return Object.values(result).every((value) => value === PermissionsAndroid.RESULTS.GRANTED);
}

function scanForEventBeacon(eventId: string): Promise<{ status: "found"; rssi: number | null } | { status: "not_found" } | { status: "error"; reason: string }> {
  const identity = getEventBeaconIdentity(eventId);

  return new Promise((resolve) => {
    let settled = false;
    let stateSubscription: { remove: () => void } | null = null;

    const finish = (result: { status: "found"; rssi: number | null } | { status: "not_found" } | { status: "error"; reason: string }) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutHandle);
      stateSubscription?.remove();
      void bleManager.stopDeviceScan();
      resolve(result);
    };

    const timeoutHandle = setTimeout(() => {
      finish({ status: "not_found" });
    }, BLE_SCAN_TIMEOUT_MS);

    stateSubscription = bleManager.onStateChange((state) => {
      if (state !== "PoweredOn") {
        return;
      }

      stateSubscription?.remove();
      stateSubscription = null;

      bleManager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
        if (error) {
          finish({ status: "error", reason: error.message });
          return;
        }

        if (device && deviceMatchesBeacon(device, identity)) {
          finish({ status: "found", rssi: device.rssi });
        }
      });
    }, true);
  });
}

function deviceMatchesBeacon(device: Device, identity: BeaconIdentity) {
  if (!device.manufacturerData) {
    return false;
  }

  const data = base64ToBytes(device.manufacturerData);
  const uuidBytes = uuidToBytes(identity.uuid);

  for (let index = 0; index <= data.length - 22; index += 1) {
    if (data[index] !== 0x02 || data[index + 1] !== 0x15) {
      continue;
    }

    if (!bytesEqual(data, index + 2, uuidBytes)) {
      continue;
    }

    const major = (data[index + 18] << 8) | data[index + 19];
    const minor = (data[index + 20] << 8) | data[index + 21];

    if (major === identity.major && minor === identity.minor) {
      return true;
    }
  }

  return false;
}

function uuidToBytes(uuid: string) {
  const hex = uuid.replace(/-/g, "");
  const bytes: number[] = [];

  for (let index = 0; index < hex.length; index += 2) {
    bytes.push(Number.parseInt(hex.slice(index, index + 2), 16));
  }

  return bytes;
}

function bytesEqual(data: number[], offset: number, expected: number[]) {
  for (let index = 0; index < expected.length; index += 1) {
    if (data[offset + index] !== expected[index]) {
      return false;
    }
  }

  return true;
}

function base64ToBytes(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of value.replace(/=+$/, "")) {
    const next = alphabet.indexOf(char);
    if (next < 0) {
      continue;
    }

    buffer = (buffer << 6) | next;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return bytes;
}

function hashEventId(eventId: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < eventId.length; index += 1) {
    hash ^= eventId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
