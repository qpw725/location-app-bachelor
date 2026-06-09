import { useMemo, useState } from "react";
import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import Slider from "@react-native-community/slider";
import type { EventAttendanceMethod, RootStackParamList } from "../../../App";
import StepIndicator from "../../components/StepIndicator";
import { saveEventBehaviorTriggers, type EventTriggerInput } from "../../data/eventRules";
import { supabase } from "../../supabase";
import { colors, commonStyles } from "../../styles/common";

type Props = NativeStackScreenProps<RootStackParamList, "CreateEventAttendance">;

const presenceOptions: Array<{
  method: EventAttendanceMethod;
  title: string;
  eyebrow: string;
  description: string;
}> = [
  {
    method: "gps_geofence",
    title: "GPS event area",
    eyebrow: "Location radius",
    description: "Uses the event location and radius to mark people as present when they are inside the area.",
  },
];

type BehaviorRuleId =
  | "host_enters_area"
  | "host_leaves_area"
  | "minimum_present"
  | "missing_after_start"
  | "capacity_warning";

const behaviorRules: Array<{
  id: BehaviorRuleId;
  title: string;
  description: string;
}> = [
  {
    id: "host_enters_area",
    title: "Host enters area",
    description: "The event can become active when the host is physically present.",
  },
  {
    id: "host_leaves_area",
    title: "Host leaves area",
    description: "The event stops when the host leaves the event area after it has started.",
  },
  {
    id: "minimum_present",
    title: "Minimum participants present",
    description: "The event can be marked ready when enough participants have arrived.",
  },
  {
    id: "missing_after_start",
    title: "Missing participants",
    description: "The host can see accepted participants who are not present after the event starts.",
  },
  {
    id: "capacity_warning",
    title: "Capacity warning",
    description: "The host can be warned when the present count reaches a selected limit.",
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
  const [liveMapEnabled, setLiveMapEnabled] = useState(false);
  const [attendanceRadiusMeters, setAttendanceRadiusMeters] = useState(75);
  const [attendanceRadiusInput, setAttendanceRadiusInput] = useState("75");
  const [enabledRules, setEnabledRules] = useState<Record<BehaviorRuleId, boolean>>({
    host_enters_area: true,
    host_leaves_area: true,
    minimum_present: false,
    missing_after_start: true,
    capacity_warning: false,
  });
  const [minimumPresentCount, setMinimumPresentCount] = useState("4");
  const [missingAfterMinutes, setMissingAfterMinutes] = useState("10");
  const [capacityWarningCount, setCapacityWarningCount] = useState("30");
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [createEventError, setCreateEventError] = useState<string | null>(null);
  const [createEventSuccess, setCreateEventSuccess] = useState<string | null>(null);

  const selectedPresenceOption = useMemo(
    () => presenceOptions.find((option) => option.method === selectedMethod) ?? presenceOptions[0],
    [selectedMethod]
  );

  const enabledRuleCount = useMemo(
    () => Object.values(enabledRules).filter(Boolean).length,
    [enabledRules]
  );

  const selectedRuleSummaries = useMemo(() => {
    const summaries: string[] = [];

    if (enabledRules.host_enters_area) {
      summaries.push("Event can become active when the host is present");
    }

    if (enabledRules.host_leaves_area) {
      summaries.push("Event stops when the host leaves after start");
    }

    if (enabledRules.minimum_present) {
      summaries.push(`Ready when ${minimumPresentCount || "0"} participants are present`);
    }

    if (enabledRules.missing_after_start) {
      summaries.push(`Show missing participants after ${missingAfterMinutes || "0"} minutes`);
    }

    if (enabledRules.capacity_warning) {
      summaries.push(`Warn host at ${capacityWarningCount || "0"} present participants`);
    }

    return summaries;
  }, [attendanceRadiusMeters, capacityWarningCount, enabledRules, minimumPresentCount, missingAfterMinutes]);

  function updateAttendanceRadius(value: number) {
    const nextRadius = clampRadius(value);
    setAttendanceRadiusMeters(nextRadius);
    setAttendanceRadiusInput(String(nextRadius));
  }

  function commitAttendanceRadiusInput() {
    const parsed = Number(attendanceRadiusInput.replace(",", "."));
    updateAttendanceRadius(Number.isFinite(parsed) ? parsed : attendanceRadiusMeters);
  }

  function updateNumericInput(value: string, setter: (nextValue: string) => void) {
    setter(value.replace(/[^0-9]/g, "").slice(0, 4));
  }

  function toggleRule(ruleId: BehaviorRuleId) {
    setEnabledRules((prev) => ({
      ...prev,
      [ruleId]: !prev[ruleId],
    }));
  }

  function buildTriggerRows(): EventTriggerInput[] {
    const triggers: EventTriggerInput[] = [];

    if (enabledRules.host_enters_area || enabledRules.host_leaves_area) {
      triggers.push({
        type: "host_enters_area",
        config: {
          radiusMeters: attendanceRadiusMeters,
          requireHostPresence: enabledRules.host_enters_area,
          endWhenHostLeaves: enabledRules.host_leaves_area,
        },
      });
    }

    if (enabledRules.minimum_present) {
      triggers.push({ type: "minimum_present", config: { count: Number(minimumPresentCount) || 0 } });
    }

    if (enabledRules.missing_after_start) {
      triggers.push({ type: "missing_after_start", config: { minutesAfterStart: Number(missingAfterMinutes) || 0 } });
    }

    if (enabledRules.capacity_warning) {
      triggers.push({ type: "capacity_warning", config: { presentCount: Number(capacityWarningCount) || 0 } });
    }

    return triggers;
  }

  async function handleCreateEvent() {
    setCreateEventError(null);
    setCreateEventSuccess(null);

    if (enabledRuleCount === 0) {
      setCreateEventError("Select at least one event behavior rule.");
      return;
    }

    if (enabledRules.minimum_present && (Number(minimumPresentCount) || 0) < 1) {
      setCreateEventError("Minimum participant count must be at least 1.");
      return;
    }

    if (enabledRules.missing_after_start && (Number(missingAfterMinutes) || 0) < 1) {
      setCreateEventError("Missing participant delay must be at least 1 minute.");
      return;
    }

    if (enabledRules.capacity_warning && (Number(capacityWarningCount) || 0) < 1) {
      setCreateEventError("Capacity warning count must be at least 1.");
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
        live_map_enabled: liveMapEnabled,
        status: "scheduled",
        started_at: null,
        ended_at: null,
        ended_reason: null,
        pre_event_window_minutes: 60,
        start_mode: "scheduled",
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

    const triggerRows = buildTriggerRows();
    const { error: triggerError } = await saveEventBehaviorTriggers(createdEvent.id, triggerRows);
    if (triggerError) {
      setCreateEventError(triggerError);
      setCreatingEvent(false);
      return;
    }

    console.log("[Event behavior selected]", {
      eventId: createdEvent.id,
      presenceDetectionEnabled: true,
      presenceDetectionMethod: selectedMethod,
      liveMapEnabled,
      behaviorTriggers: triggerRows,
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
      style={commonStyles.screen}
      behavior="padding"
      keyboardVerticalOffset={96}
    >
      <ScrollView
        style={commonStyles.screen}
        contentContainerStyle={commonStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <StepIndicator step={4} total={4} label="Behavior" />

        <View style={commonStyles.heroCard}>
          <Text style={commonStyles.heroTitle}>Configure event behavior</Text>
          <Text style={commonStyles.heroSubtitle}>
            Choose how this event should react to presence, participant counts, and missing participants.
          </Text>
        </View>

        <View style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>Presence detection</Text>
          <View style={styles.optionList}>
            {presenceOptions.map((option) => {
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
          <View style={commonStyles.card}>
            <Text style={commonStyles.cardTitle}>Event area</Text>
            <Text style={styles.cardText}>Presence rules use this radius around the selected event location.</Text>
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

        <View style={commonStyles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.switchTitle}>Live map</Text>
              <Text style={styles.switchDescription}>Show live attendee markers during the event window.</Text>
            </View>
            <Switch
              value={liveMapEnabled}
              onValueChange={setLiveMapEnabled}
              trackColor={{ false: "#d8c7b3", true: "#b8d2c4" }}
              thumbColor={liveMapEnabled ? colors.primary : colors.surface}
            />
          </View>
        </View>

        <View style={commonStyles.card}>
          <View style={styles.ruleHeader}>
            <Text style={styles.cardTitleNoMargin}>Trigger rules</Text>
            <Text style={styles.ruleCounter}>{enabledRuleCount} selected</Text>
          </View>

          <View style={styles.optionList}>
            {behaviorRules.map((rule) => {
              const isSelected = enabledRules[rule.id];
              return (
                <Pressable
                  key={rule.id}
                  onPress={() => toggleRule(rule.id)}
                  style={({ pressed }) => [
                    styles.ruleCard,
                    isSelected && styles.ruleCardActive,
                    pressed && styles.methodCardPressed,
                  ]}
                >
                  <View style={styles.ruleTitleRow}>
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                      {isSelected ? <View style={styles.checkboxFill} /> : null}
                    </View>
                    <View style={styles.methodTextWrap}>
                      <Text style={[styles.ruleTitle, isSelected && styles.methodTitleActive]}>{rule.title}</Text>
                      <Text style={[styles.ruleDescription, isSelected && styles.methodDescriptionActive]}>{rule.description}</Text>
                    </View>
                  </View>

                  {rule.id === "minimum_present" && isSelected ? (
                    <View style={styles.inlineInputRow}>
                      <Text style={styles.inlineInputLabel}>Required present</Text>
                      <View style={styles.compactInputWrap}>
                        <TextInput
                          value={minimumPresentCount}
                          onChangeText={(value) => updateNumericInput(value, setMinimumPresentCount)}
                          keyboardType="number-pad"
                          maxLength={4}
                          style={styles.compactInput}
                        />
                      </View>
                    </View>
                  ) : null}

                  {rule.id === "missing_after_start" && isSelected ? (
                    <View style={styles.inlineInputRow}>
                      <Text style={styles.inlineInputLabel}>After start</Text>
                      <View style={styles.compactInputWrap}>
                        <TextInput
                          value={missingAfterMinutes}
                          onChangeText={(value) => updateNumericInput(value, setMissingAfterMinutes)}
                          keyboardType="number-pad"
                          maxLength={4}
                          style={styles.compactInput}
                        />
                        <Text style={styles.compactInputUnit}>min</Text>
                      </View>
                    </View>
                  ) : null}

                  {rule.id === "capacity_warning" && isSelected ? (
                    <View style={styles.inlineInputRow}>
                      <Text style={styles.inlineInputLabel}>Warn at</Text>
                      <View style={styles.compactInputWrap}>
                        <TextInput
                          value={capacityWarningCount}
                          onChangeText={(value) => updateNumericInput(value, setCapacityWarningCount)}
                          keyboardType="number-pad"
                          maxLength={4}
                          style={styles.compactInput}
                        />
                        <Text style={styles.compactInputUnit}>present</Text>
                      </View>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>Behavior summary</Text>
          <Text style={styles.cardText}>{selectedPresenceOption.title}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryDot} />
            <Text style={styles.summaryText}>Live map is {liveMapEnabled ? "enabled" : "disabled"}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryDot} />
            <Text style={styles.summaryText}>People are marked present inside {attendanceRadiusMeters} m</Text>
          </View>
          {selectedRuleSummaries.map((summary) => (
            <View key={summary} style={styles.summaryRow}>
              <View style={styles.summaryDot} />
              <Text style={styles.summaryText}>{summary}</Text>
            </View>
          ))}
        </View>

        {createEventError ? <Text style={commonStyles.errorText}>{createEventError}</Text> : null}
        {createEventSuccess ? <Text style={commonStyles.successText}>{createEventSuccess}</Text> : null}

        <Pressable
          style={[commonStyles.primaryButton, styles.primaryBtnTop, creatingEvent && styles.primaryBtnDisabled]}
          onPress={() => void handleCreateEvent()}
          disabled={creatingEvent}
        >
          <Text style={commonStyles.primaryButtonText}>
            {creatingEvent ? "Creating..." : visibility === "Public" ? "Publish event" : "Create event"}
          </Text>
        </Pressable>

        <View style={styles.spacerSmall} />

        <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [commonStyles.backButton, pressed && commonStyles.pressed]}>
          <Text style={commonStyles.backButtonText}>Back</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  cardTitleNoMargin: { fontSize: 18, fontWeight: "700", color: "#201c19" },
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  switchTextWrap: {
    flex: 1,
  },
  switchTitle: {
    color: "#201c19",
    fontSize: 14,
    fontWeight: "800",
  },
  switchDescription: {
    color: "#6f6258",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  ruleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  ruleCounter: {
    color: "#2f5d50",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  ruleCard: {
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 18,
    backgroundColor: "#fff6ea",
    padding: 14,
  },
  ruleCardActive: {
    borderColor: "#2f5d50",
    backgroundColor: "#edf4ee",
  },
  ruleTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#b9a894",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxActive: {
    borderColor: "#2f5d50",
    backgroundColor: "#dfece2",
  },
  checkboxFill: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: "#2f5d50",
  },
  ruleTitle: {
    color: "#201c19",
    fontSize: 15,
    fontWeight: "800",
  },
  ruleDescription: {
    color: "#5f5145",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  inlineInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#dbe7dc",
  },
  inlineInputLabel: {
    color: "#36574b",
    fontSize: 13,
    fontWeight: "800",
  },
  compactInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#c9dacd",
    borderRadius: 14,
    backgroundColor: "#fffaf4",
    paddingHorizontal: 10,
  },
  compactInput: {
    minWidth: 42,
    paddingVertical: 7,
    color: "#201c19",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  compactInputUnit: {
    color: "#6f6258",
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 4,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 6,
  },
  summaryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#2f5d50",
    marginTop: 7,
  },
  summaryText: {
    flex: 1,
    color: "#5f5145",
    fontSize: 14,
    lineHeight: 20,
  },
  primaryBtnTop: {
    marginTop: 6,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  spacerSmall: { height: 10 },
  pressed: { opacity: 0.86 },
});
