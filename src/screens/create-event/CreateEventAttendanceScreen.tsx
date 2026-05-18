import { useMemo, useState } from "react";
import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Slider from "@react-native-community/slider";
import type { EventAttendanceMethod, RootStackParamList } from "../../../App";
import StepIndicator from "../../components/StepIndicator";
import { supabase } from "../../supabase";

type Props = NativeStackScreenProps<RootStackParamList, "CreateEventAttendance">;

const attendanceOptions: Array<{
  method: EventAttendanceMethod;
  title: string;
  eyebrow: string;
  description: string;
}> = [
  {
    method: "gps_geofence",
    title: "GPS geofence",
    eyebrow: "Bigger locations",
    description: "Best for outdoor events, large buildings, and venues where a wider location radius is acceptable.",
  },
  {
    method: "ble_beacon",
    title: "Bluetooth beacon",
    eyebrow: "Rooms and meetings",
    description: "Best for classrooms, offices, and smaller spaces where attendees should be physically close to the host phone.",
  },
];

const MIN_RADIUS_METERS = 10;
const MAX_RADIUS_METERS = 3000;

function clampRadius(value: number) {
  return Math.min(MAX_RADIUS_METERS, Math.max(MIN_RADIUS_METERS, Math.round(value)));
}

export default function CreateEventAttendanceScreen({ route, navigation }: Props) {
  const {
    eventName,
    eventDescription,
    location,
    eventTime,
    eventEndTime,
    eventDate,
    visibility,
    selectedCategory,
    invitedPeople,
  } = route.params;

  const [selectedMethod, setSelectedMethod] = useState<EventAttendanceMethod>("gps_geofence");
  const [attendanceRadiusMeters, setAttendanceRadiusMeters] = useState(75);
  const [attendanceRadiusInput, setAttendanceRadiusInput] = useState("75");
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [createEventError, setCreateEventError] = useState<string | null>(null);
  const [createEventSuccess, setCreateEventSuccess] = useState<string | null>(null);

  const selectedOption = useMemo(
    () => attendanceOptions.find((option) => option.method === selectedMethod) ?? attendanceOptions[0],
    [selectedMethod]
  );

  function updateAttendanceRadius(value: number) {
    const nextRadius = clampRadius(value);
    setAttendanceRadiusMeters(nextRadius);
    setAttendanceRadiusInput(String(nextRadius));
  }

  function commitAttendanceRadiusInput() {
    const parsed = Number(attendanceRadiusInput.replace(",", "."));
    updateAttendanceRadius(Number.isFinite(parsed) ? parsed : attendanceRadiusMeters);
  }

  async function handleCreateEvent() {
    setCreateEventError(null);
    setCreateEventSuccess(null);

    if (selectedMethod === "ble_beacon") {
      const message = "Bluetooth beacon attendance is not implemented yet. Please choose GPS geofence for now.";
      setCreateEventError(message);
      Alert.alert("Not implemented yet", message);
      return;
    }

    setCreatingEvent(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setCreateEventError(userError?.message ?? "Could not identify current user.");
      setCreatingEvent(false);
      return;
    }

    const startDate = new Date(
      eventDate.year,
      eventDate.month - 1,
      eventDate.day,
      eventTime.hour,
      eventTime.minute,
      0,
      0
    );
    const endDate = new Date(
      eventDate.year,
      eventDate.month - 1,
      eventDate.day,
      eventEndTime.hour,
      eventEndTime.minute,
      0,
      0
    );

    if (startDate.getTime() <= Date.now()) {
      setCreateEventError("Start time must be in the future.");
      setCreatingEvent(false);
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setCreateEventError("End time must be after start time.");
      setCreatingEvent(false);
      return;
    }

    const { data: createdEvent, error } = await supabase
      .from("events")
      .insert({
        creator_id: userData.user.id,
        title: eventName.trim(),
        description: eventDescription?.trim() ? eventDescription.trim() : null,
        location: location.label,
        latitude: location.latitude,
        longitude: location.longitude,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        genre: selectedCategory,
        private: visibility === "Private",
        attendance_enabled: true,
        attendance_method: selectedMethod,
        attendance_radius_meters: selectedMethod === "gps_geofence" ? attendanceRadiusMeters : null,
      })
      .select("id")
      .single();

    if (error) {
      setCreateEventError(error.message);
      setCreatingEvent(false);
      return;
    }

    if (invitedPeople.length > 0) {
      const inviteRows = invitedPeople
        .filter((profile) => profile.id !== userData.user.id)
        .map((profile) => ({
          event_id: createdEvent.id,
          invitee_id: profile.id,
          status: "pending",
        }));

      if (inviteRows.length > 0) {
        const { error: inviteInsertError } = await supabase
          .from("event_invites")
          .upsert(inviteRows, { onConflict: "event_id,invitee_id" });

        if (inviteInsertError) {
          setCreateEventError(inviteInsertError.message);
          setCreatingEvent(false);
          return;
        }
      }
    }

    console.log("[Attendance setup selected]", {
      eventId: createdEvent.id,
      attendanceCountingEnabled: true,
      attendanceMethod: selectedMethod,
    });

    setCreateEventSuccess("Event created successfully.");
    setCreatingEvent(false);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: "MyEvents" } }],
      })
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={96}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <StepIndicator step={4} total={4} label="Attendance" />

        <View style={styles.heroCard}>
          <Text style={styles.title}>Choose how attendance should be counted</Text>
          <Text style={styles.heroText}>
            GPS attendance can count people automatically. Bluetooth beacon attendance is kept as an option, but is not implemented yet.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Counting method</Text>
          <View style={styles.optionList}>
            {attendanceOptions.map((option) => {
              const isSelected = option.method === selectedMethod;
              return (
                <Pressable
                  key={option.method}
                  onPress={() => setSelectedMethod(option.method)}
                  style={({ pressed }) => [
                    styles.methodCard,
                    isSelected && styles.methodCardActive,
                    pressed && styles.methodCardPressed,
                  ]}
                >
                  <View style={styles.methodHeader}>
                    <View style={[styles.radio, isSelected && styles.radioActive]}>
                      {isSelected ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={styles.methodTextWrap}>
                      <Text style={[styles.methodTitle, isSelected && styles.methodTitleActive]}>{option.title}</Text>
                      <Text style={[styles.methodEyebrow, isSelected && styles.methodEyebrowActive]}>{option.eyebrow}</Text>
                    </View>
                  </View>
                  <Text style={[styles.methodDescription, isSelected && styles.methodDescriptionActive]}>
                    {option.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {selectedMethod === "gps_geofence" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Geofence radius</Text>
            <Text style={styles.cardText}>People inside this distance from the event location can be counted automatically.</Text>
            <View style={styles.radiusHeader}>
              <Text style={styles.radiusValue}>{attendanceRadiusMeters} m</Text>
              <View style={styles.radiusInputWrap}>
                <TextInput
                  value={attendanceRadiusInput}
                  onChangeText={setAttendanceRadiusInput}
                  onBlur={commitAttendanceRadiusInput}
                  onSubmitEditing={commitAttendanceRadiusInput}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={styles.radiusInput}
                />
                <Text style={styles.radiusInputUnit}>m</Text>
              </View>
            </View>
            <Slider
              style={styles.radiusSlider}
              minimumValue={MIN_RADIUS_METERS}
              maximumValue={MAX_RADIUS_METERS}
              step={10}
              value={attendanceRadiusMeters}
              minimumTrackTintColor="#2f5d50"
              maximumTrackTintColor="#efe4d7"
              thumbTintColor="#2f5d50"
              onValueChange={updateAttendanceRadius}
            />
            <View style={styles.radiusScale}>
              <Text style={styles.radiusScaleText}>{MIN_RADIUS_METERS} m</Text>
              <Text style={styles.radiusScaleText}>{MAX_RADIUS_METERS} m</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Selected setup</Text>
          <Text style={styles.cardText}>{selectedOption.title}</Text>
          <Text style={styles.cardText}>{selectedOption.description}</Text>
          {selectedMethod === "gps_geofence" ? <Text style={styles.cardText}>Radius: {attendanceRadiusMeters} m</Text> : null}
        </View>

        {createEventError ? <Text style={styles.errorText}>{createEventError}</Text> : null}
        {createEventSuccess ? <Text style={styles.successText}>{createEventSuccess}</Text> : null}

        <Pressable
          style={[styles.primaryBtn, creatingEvent && styles.primaryBtnDisabled]}
          onPress={() => void handleCreateEvent()}
          disabled={creatingEvent}
        >
          <Text style={styles.primaryBtnText}>
            {creatingEvent ? "Creating..." : visibility === "Public" ? "Publish event" : "Create event"}
          </Text>
        </Pressable>

        <View style={styles.spacerSmall} />

        <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f1e8" },
  content: { padding: 20, paddingBottom: 120 },
  heroCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eadfce",
    shadowColor: "#7a5c3d",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8, color: "#1f1a17" },
  heroText: { fontSize: 15, lineHeight: 22, color: "#67594d" },
  card: {
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 22,
    padding: 16,
    backgroundColor: "#fffaf4",
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", marginBottom: 10, color: "#201c19" },
  cardText: { fontSize: 14, color: "#5f5145", marginBottom: 6, lineHeight: 20 },
  optionList: { gap: 10 },
  methodCard: {
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 18,
    backgroundColor: "#fff6ea",
    padding: 14,
  },
  methodCardActive: {
    borderColor: "#2f5d50",
    backgroundColor: "#edf4ee",
  },
  methodCardPressed: { opacity: 0.88 },
  methodHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#b9a894",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  radioActive: {
    borderColor: "#2f5d50",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2f5d50",
  },
  methodTextWrap: { flex: 1 },
  methodTitle: { color: "#201c19", fontSize: 16, fontWeight: "800" },
  methodTitleActive: { color: "#173d33" },
  methodEyebrow: { color: "#8a6a4a", fontSize: 12, fontWeight: "700", marginTop: 2, textTransform: "uppercase" },
  methodEyebrowActive: { color: "#2f5d50" },
  methodDescription: { color: "#5f5145", fontSize: 13, lineHeight: 19 },
  methodDescriptionActive: { color: "#36574b" },
  radiusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
  },
  radiusValue: {
    color: "#201c19",
    fontSize: 22,
    fontWeight: "900",
  },
  radiusInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 14,
    backgroundColor: "#fff6ea",
    paddingHorizontal: 10,
  },
  radiusInput: {
    minWidth: 58,
    paddingVertical: 8,
    color: "#201c19",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  radiusInputUnit: {
    color: "#6f6258",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 4,
  },
  radiusSlider: {
    height: 38,
    marginTop: 8,
  },
  radiusScale: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  radiusScaleText: {
    color: "#8a7f74",
    fontSize: 12,
    fontWeight: "700",
  },
  primaryBtn: {
    marginTop: 6,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "#2f5d50",
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  errorText: {
    color: "#a23d3d",
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: "#fff4f1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  successText: {
    color: "#2f5d50",
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: "#eef3e8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  spacerSmall: { height: 10 },
  backBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  backBtnText: { fontSize: 14, color: "#4f4339", fontWeight: "700" },
  pressed: { opacity: 0.86 },
});
