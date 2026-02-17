import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { View, Text, TextInput, Button, StyleSheet, Pressable, Platform } from "react-native";
import { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import StepIndicator from "../components/StepIndicator";


type Props = NativeStackScreenProps<RootStackParamList, "CreateEvent">;

export default function CreateEventScreen({ navigation }: Props) {
  const [eventName, setEventName] = useState("");
  const [eventTime, setEventTime] = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return now;
  });
  const [showAndroidTimePicker, setShowAndroidTimePicker] = useState(false);

  const canContinue = eventName.trim().length > 0;
  const formattedTime = eventTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

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
      <Text style={styles.title}>Create event</Text>

      <Text style={styles.label}>Event name</Text>
      <TextInput
        value={eventName}
        onChangeText={setEventName}
        placeholder="e.g. Pre-drinks at Bens"
        style={styles.input}
      />

      <View style={styles.timeSection}>
        <Text style={styles.label}>Event time</Text>

        {Platform.OS === "ios" ? (
          <View style={styles.iosPickerWrap}>
            <DateTimePicker
              value={eventTime}
              mode="time"
              display="spinner"
              onChange={onTimeChange}
            />
          </View>
        ) : (
          <>
            <Pressable onPress={() => setShowAndroidTimePicker(true)} style={styles.timeButton}>
              <Text style={styles.timeButtonText}>{formattedTime}</Text>
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
  timeSection: { marginTop: 14 },
  iosPickerWrap: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingTop: 4,
    alignItems: "stretch",
  },
  timeButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  timeButtonText: { fontSize: 16 },
  spacer: { height: 16 },
});
