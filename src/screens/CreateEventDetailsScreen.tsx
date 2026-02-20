import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { View, Text, TextInput, Button, StyleSheet, Pressable, Platform } from "react-native";
import { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import StepIndicator from "../components/StepIndicator";


type Props = NativeStackScreenProps<RootStackParamList, "CreateEventDetails">;

export default function CreateEventDetailsScreen({ navigation }: Props) {
  const [eventName, setEventName] = useState("");
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
  const [showAndroidDatePicker, setShowAndroidDatePicker] = useState(false);
  const [showAndroidTimePicker, setShowAndroidTimePicker] = useState(false);

  const canContinue = eventName.trim().length > 0;
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

  return (
    <View style={styles.container}>
      <StepIndicator step={1} total={3} label="Create event" />
      <Text style={styles.title}>Create event and time</Text>

      <Text style={styles.label}>Event name</Text>
      <TextInput
        value={eventName}
        onChangeText={setEventName}
        placeholder="e.g. Pre-drinks at Bens"
        style={styles.input}
      />

      <View style={styles.pickerSection}>
        <Text style={styles.label}>Event date</Text>

        {Platform.OS === "ios" ? (
          <View style={styles.iosPickerWrap}>
            <DateTimePicker
              value={eventDate}
              mode="date"
              display="compact"
              onChange={onDateChange}
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
              />
            )}
          </>
        )}
      </View>

      <View style={styles.pickerSection}>
        <Text style={styles.label}>Event time</Text>

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

      <View style={styles.spacer} />

      <Button
        title="Choose location"
        onPress={() =>
          navigation.navigate("ChooseLocation", {
            eventName: eventName.trim(),
            eventDate: {
              year: eventDate.getFullYear(),
              month: eventDate.getMonth() + 1,
              day: eventDate.getDate(),
            },
            eventTime: {
              hour: eventTime.getHours(),
              minute: eventTime.getMinutes(),
            },
          })
        }
        disabled={!canContinue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 20 },
  label: { fontSize: 14, marginBottom: 8, opacity: 0.8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  pickerSection: { marginTop: 14 },
  iosPickerWrap: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "stretch",
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pickerButtonText: { fontSize: 16 },
  spacer: { height: 16 },
});


