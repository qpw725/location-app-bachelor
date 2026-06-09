import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import StepIndicator from "../../components/StepIndicator";
import { colors, commonStyles } from "../../styles/common";


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
  function onDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    setEventDate(selectedDate);
  }

  function onTimeChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    setEventTime(selectedDate);
  }

  function onEndTimeChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    setEventEndTime(selectedDate);
  }

  return (
    <KeyboardAvoidingView
      style={commonStyles.screen}
      behavior="padding"
    >
      <ScrollView
        contentContainerStyle={commonStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <StepIndicator step={1} total={3} label="Create event" />
        <View style={commonStyles.heroCard}>
          <Text style={commonStyles.heroTitle}>Set the basics for your event</Text>
          <Text style={commonStyles.heroSubtitle}>Choose the name, description, date, and timing before you move on to location.</Text>
        </View>

        <View style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>Details</Text>
          <Text style={commonStyles.label}>Event name</Text>
          <TextInput
            value={eventName}
            onChangeText={setEventName}
            placeholder="e.g. Pre-drinks at Ben's"
            placeholderTextColor="#8a7f74"
            style={commonStyles.input}
          />

          <Text style={commonStyles.label}>Description (optional)</Text>
          <TextInput
            value={eventDescription}
            onChangeText={setEventDescription}
            placeholder="What is this event about?"
            placeholderTextColor="#8a7f74"
            style={[commonStyles.input, styles.descriptionInput]}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>Date and time</Text>

          <View style={styles.pickerSection}>
            <Text style={commonStyles.label}>Event date</Text>

            <View style={styles.iosPickerWrap}>
              <DateTimePicker
                value={eventDate}
                mode="date"
                display="compact"
                onChange={onDateChange}
                minimumDate={new Date()}
              />
            </View>
          </View>

          <View style={styles.pickerSection}>
            <Text style={commonStyles.label}>Start time</Text>

            <View style={styles.iosPickerWrap}>
              <DateTimePicker
                value={eventTime}
                mode="time"
                display="compact"
                onChange={onTimeChange}
              />
            </View>
          </View>

          <View style={styles.pickerSection}>
            <Text style={commonStyles.label}>End time</Text>

            <View style={styles.iosPickerWrap}>
              <DateTimePicker
                value={eventEndTime}
                mode="time"
                display="compact"
                onChange={onEndTimeChange}
              />
            </View>
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
          style={({ pressed }) => [commonStyles.primaryButton, pressed && commonStyles.pressed, !canContinue && commonStyles.primaryButtonDisabled]}
          onPress={() =>
            navigation.navigate("CreateEventLocation", {
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
          <Text style={commonStyles.primaryButtonText}>Choose location</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pickerSection: { marginTop: 14 },
  iosPickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "stretch",
    backgroundColor: colors.surface,
  },
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
  spacer: { height: 16 },
});


