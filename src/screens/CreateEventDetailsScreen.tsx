import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import StepIndicator from "../components/StepIndicator";


type Props = NativeStackScreenProps<RootStackParamList, "CreateEventDetails">;

export default function CreateEventDetailsScreen({ navigation }: Props) {
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDate, setEventDate] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [eventTime, setEventTime] = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return now;
  });
  const [eventEndTime, setEventEndTime] = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    now.setHours(now.getHours() + 2);
    return now;
  });
  const [showAndroidDatePicker, setShowAndroidDatePicker] = useState(false);
  const [showAndroidTimePicker, setShowAndroidTimePicker] = useState(false);
  const [showAndroidEndTimePicker, setShowAndroidEndTimePicker] = useState(false);

  const eventStartOnDate = new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate(),
    eventTime.getHours(),
    eventTime.getMinutes(),
    0,
    0
  );
  const eventEndOnDate = new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate(),
    eventEndTime.getHours(),
    eventEndTime.getMinutes(),
    0,
    0
  );
  const now = new Date();
  const hasFutureStartTime = eventStartOnDate.getTime() > now.getTime();
  const hasValidTimeRange = eventEndOnDate.getTime() > eventStartOnDate.getTime();
  const canContinue = eventName.trim().length > 0 && hasValidTimeRange && hasFutureStartTime;
  const formattedDate = eventDate.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const formattedTime = eventTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const formattedEndTime = eventEndTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  function onDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === "android") {
      setShowAndroidDatePicker(false);
    }

    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    setEventDate(selectedDate);
  }

  function onTimeChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === "android") {
      setShowAndroidTimePicker(false);
    }

    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    setEventTime(selectedDate);
  }

  function onEndTimeChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === "android") {
      setShowAndroidEndTimePicker(false);
    }

    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    setEventEndTime(selectedDate);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        <StepIndicator step={1} total={3} label="Create event" />
        <View style={styles.heroCard}>
          <Text style={styles.title}>Set the basics for your event</Text>
          <Text style={styles.heroText}>Choose the name, description, date, and timing before you move on to location.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <Text style={styles.label}>Event name</Text>
          <TextInput
            value={eventName}
            onChangeText={setEventName}
            placeholder="e.g. Pre-drinks at Ben's"
            placeholderTextColor="#8a7f74"
            style={styles.input}
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            value={eventDescription}
            onChangeText={setEventDescription}
            placeholder="What is this event about?"
            placeholderTextColor="#8a7f74"
            style={[styles.input, styles.descriptionInput]}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Date and time</Text>

          <View style={styles.pickerSection}>
            <Text style={styles.label}>Event date</Text>

            {Platform.OS === "ios" ? (
              <View style={styles.iosPickerWrap}>
                <DateTimePicker
                  value={eventDate}
                  mode="date"
                  display="compact"
                  onChange={onDateChange}
                  minimumDate={new Date()}
                />
              </View>
            ) : (
              <>
                <Pressable onPress={() => setShowAndroidDatePicker(true)} style={styles.pickerButton}>
                  <Text style={styles.pickerButtonText}>{formattedDate}</Text>
                </Pressable>
                {showAndroidDatePicker && (
                  <DateTimePicker
                    value={eventDate}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                    minimumDate={new Date()}
                  />
                )}
              </>
            )}
          </View>

          <View style={styles.pickerSection}>
            <Text style={styles.label}>Start time</Text>

            {Platform.OS === "ios" ? (
              <View style={styles.iosPickerWrap}>
                <DateTimePicker
                  value={eventTime}
                  mode="time"
                  display="compact"
                  onChange={onTimeChange}
                />
              </View>
            ) : (
              <>
                <Pressable onPress={() => setShowAndroidTimePicker(true)} style={styles.pickerButton}>
                  <Text style={styles.pickerButtonText}>{formattedTime}</Text>
                </Pressable>
                {showAndroidTimePicker && (
                  <DateTimePicker
                    value={eventTime}
                    mode="time"
                    display="default"
                    onChange={onTimeChange}
                  />
                )}
              </>
            )}
          </View>

          <View style={styles.pickerSection}>
            <Text style={styles.label}>End time</Text>

            {Platform.OS === "ios" ? (
              <View style={styles.iosPickerWrap}>
                <DateTimePicker
                  value={eventEndTime}
                  mode="time"
                  display="compact"
                  onChange={onEndTimeChange}
                />
              </View>
            ) : (
              <>
                <Pressable onPress={() => setShowAndroidEndTimePicker(true)} style={styles.pickerButton}>
                  <Text style={styles.pickerButtonText}>{formattedEndTime}</Text>
                </Pressable>
                {showAndroidEndTimePicker && (
                  <DateTimePicker
                    value={eventEndTime}
                    mode="time"
                    display="default"
                    onChange={onEndTimeChange}
                  />
                )}
              </>
            )}
          </View>
        </View>

        {!hasFutureStartTime ? (
          <Text style={styles.errorCard}>Start time must be in the future.</Text>
        ) : null}

        {!hasValidTimeRange ? (
          <Text style={styles.errorCard}>End time must be after start time.</Text>
        ) : null}

        <View style={styles.spacer} />

        <Pressable
          style={({ pressed }) => [styles.primaryButton, (!canContinue || pressed) && styles.primaryButtonPressed, !canContinue && styles.primaryButtonDisabled]}
          onPress={() =>
            navigation.navigate("ChooseLocation", {
              eventName: eventName.trim(),
              eventDescription: eventDescription.trim() || undefined,
              eventDate: {
                year: eventDate.getFullYear(),
                month: eventDate.getMonth() + 1,
                day: eventDate.getDate(),
              },
              eventTime: {
                hour: eventTime.getHours(),
                minute: eventTime.getMinutes(),
              },
              eventEndTime: {
                hour: eventEndTime.getHours(),
                minute: eventEndTime.getMinutes(),
              },
            })
          }
          disabled={!canContinue}
        >
          <Text style={styles.primaryButtonText}>Choose location</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f1e8" },
  content: { flexGrow: 1, padding: 20, paddingBottom: 120 },
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
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#201c19", marginBottom: 8 },
  label: { fontSize: 14, marginBottom: 8, color: "#201c19", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#eadfce",
    backgroundColor: "#fffaf4",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#201c19",
  },
  pickerSection: { marginTop: 14 },
  iosPickerWrap: {
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "stretch",
    backgroundColor: "#fffaf4",
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fffaf4",
  },
  pickerButtonText: { fontSize: 16, color: "#201c19" },
  descriptionInput: {
    minHeight: 90,
  },
  errorCard: {
    marginTop: 10,
    color: "#a23d3d",
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: "#fff4f1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButton: {
    marginTop: 6,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "#2f5d50",
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonDisabled: {
    backgroundColor: "#97aa9f",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 16,
  },
  spacer: { height: 16 },
});


