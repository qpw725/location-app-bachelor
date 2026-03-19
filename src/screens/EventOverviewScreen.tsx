import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from "react-native";
import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import StepIndicator from "../components/StepIndicator";
import { supabase } from "../supabase";

type Props = NativeStackScreenProps<RootStackParamList, "EventOverview">;

type InvitedFriend = {
  id: string;
  username: string;
};

const categoryOptions = [
  "Sports",
  "Fitness",
  "Running",
  "Social",
  "Party",
  "Food & Drinks",
  "Celebration",
  "Study / Work",
  "Outdoor",
  "Games",
  "Wellness",
  "Travel",
  "Culture",
  "Other",
];
const frequencyOptions = ["Low", "Medium", "High"] as const;

export default function EventOverviewScreen({ route, navigation }: Props) {
  const { eventName, eventDescription, location, eventTime, eventEndTime, eventDate } = route.params;

  const [visibility, setVisibility] = useState<"Private" | "Public">("Private");
  const [selectedCategory, setSelectedCategory] = useState(categoryOptions[0]);
  const [notifyLocationUpdates, setNotifyLocationUpdates] = useState(true);
  const [notifyArrivalUpdates, setNotifyArrivalUpdates] = useState(true);
  const [notificationFrequency, setNotificationFrequency] = useState<(typeof frequencyOptions)[number]>("Medium");
  const [inviteInput, setInviteInput] = useState("");
  const [invitedPeople, setInvitedPeople] = useState<InvitedFriend[]>([]);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [addingInvitee, setAddingInvitee] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [createEventError, setCreateEventError] = useState<string | null>(null);
  const [createEventSuccess, setCreateEventSuccess] = useState<string | null>(null);

  const locationLabel = useMemo(() => {
    const maxLocationLength = 52;
    return location.label.length > maxLocationLength
      ? `${location.label.slice(0, maxLocationLength)}...`
      : location.label;
  }, [location.label]);

  const eventStartTimeLabel = useMemo(
    () =>
      new Date(0, 0, 0, eventTime.hour, eventTime.minute).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [eventTime.hour, eventTime.minute]
  );
  const eventEndTimeLabel = useMemo(
    () =>
      new Date(0, 0, 0, eventEndTime.hour, eventEndTime.minute).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [eventEndTime.hour, eventEndTime.minute]
  );

  const eventDateLabel = useMemo(
    () =>
      new Date(eventDate.year, eventDate.month - 1, eventDate.day).toLocaleDateString([], {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [eventDate.day, eventDate.month, eventDate.year]
  );

  async function addInvitee() {
    const trimmed = inviteInput.trim();
    if (!trimmed) {
      setInviteError("Enter a username first.");
      setInviteSuccess(null);
      return;
    }

    setInviteError(null);
    setInviteSuccess(null);
    setAddingInvitee(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setInviteError(userError?.message ?? "Could not identify current user.");
      setAddingInvitee(false);
      return;
    }

    const activeUserId = userData.user.id;

    const { data: friendProfile, error: friendLookupError } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", trimmed)
      .limit(1)
      .maybeSingle();

    if (friendLookupError) {
      setInviteError(friendLookupError.message);
      setAddingInvitee(false);
      return;
    }

    if (!friendProfile || !friendProfile.username) {
      setInviteError("Username is nonexistent.");
      setAddingInvitee(false);
      return;
    }

    if (friendProfile.id === activeUserId) {
      setInviteError("You cannot invite yourself.");
      setAddingInvitee(false);
      return;
    }

    const [userA, userB] = [activeUserId, friendProfile.id].sort();
    const { data: existingFriendship, error: friendshipError } = await supabase
      .from("friendships")
      .select("user_a")
      .eq("user_a", userA)
      .eq("user_b", userB)
      .maybeSingle();

    if (friendshipError) {
      setInviteError(friendshipError.message);
      setAddingInvitee(false);
      return;
    }

    if (!existingFriendship) {
      setInviteError("You can only invite users who are already your friends.");
      setAddingInvitee(false);
      return;
    }

    const username = friendProfile.username.trim();
    setInvitedPeople((prev) => {
      if (prev.some((person) => person.id === friendProfile.id)) {
        return prev;
      }
      return [...prev, { id: friendProfile.id, username }];
    });
    setInviteInput("");
    setInviteSuccess(`@${username} added to invite list.`);
    setAddingInvitee(false);
  }

  async function handleCreateEvent() {
    setCreateEventError(null);
    setCreateEventSuccess(null);
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

    setCreateEventSuccess("Event created successfully.");
    setCreatingEvent(false);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: "Events" } }],
      })
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StepIndicator step={3} total={3} label="Finalize" />
      <Text style={styles.title}>Finalize event</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Event summary</Text>
        <Text style={styles.cardText}>Title: {eventName}</Text>
        {eventDescription?.trim() ? <Text style={styles.cardText}>Description: {eventDescription}</Text> : null}
        <Text style={styles.cardText}>Location: {locationLabel}</Text>
        <Text style={styles.cardText}>Date: {eventDateLabel}</Text>
        <Text style={styles.cardText}>Start: {eventStartTimeLabel}</Text>
        <Text style={styles.cardText}>End: {eventEndTimeLabel}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Event settings</Text>

        <Text style={styles.settingLabel}>Visibility</Text>
        <View style={styles.toggleRow}>
          {(["Private", "Public"] as const).map((option) => (
            <Pressable
              key={option}
              style={[styles.optionChip, visibility === option && styles.optionChipActive]}
              onPress={() => setVisibility(option)}
            >
              <Text style={[styles.optionChipText, visibility === option && styles.optionChipTextActive]}>{option}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.settingLabel}>Category</Text>
        <View style={styles.toggleRow}>
          {categoryOptions.map((option) => (
            <Pressable
              key={option}
              style={[styles.optionChip, selectedCategory === option && styles.optionChipActive]}
              onPress={() => setSelectedCategory(option)}
            >
              <Text style={[styles.optionChipText, selectedCategory === option && styles.optionChipTextActive]}>{option}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.settingLabel}>Notification settings</Text>
        <View style={styles.inlineSettingRow}>
          <Text style={styles.inlineSettingText}>Notify about participant location updates</Text>
          <Pressable
            style={[styles.smallToggle, notifyLocationUpdates && styles.smallToggleActive]}
            onPress={() => setNotifyLocationUpdates((prev) => !prev)}
          >
            <Text style={[styles.smallToggleText, notifyLocationUpdates && styles.smallToggleTextActive]}>
              {notifyLocationUpdates ? "On" : "Off"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.inlineSettingRow}>
          <Text style={styles.inlineSettingText}>Notify when participants are on the way / arrived</Text>
          <Pressable
            style={[styles.smallToggle, notifyArrivalUpdates && styles.smallToggleActive]}
            onPress={() => setNotifyArrivalUpdates((prev) => !prev)}
          >
            <Text style={[styles.smallToggleText, notifyArrivalUpdates && styles.smallToggleTextActive]}>
              {notifyArrivalUpdates ? "On" : "Off"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.settingLabel}>Notification frequency</Text>
        <View style={styles.toggleRow}>
          {frequencyOptions.map((option) => (
            <Pressable
              key={option}
              style={[styles.optionChip, notificationFrequency === option && styles.optionChipActive]}
              onPress={() => setNotificationFrequency(option)}
            >
              <Text style={[styles.optionChipText, notificationFrequency === option && styles.optionChipTextActive]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Invite people</Text>
        <View style={styles.inviteRow}>
          <TextInput
            value={inviteInput}
            onChangeText={setInviteInput}
            placeholder="Add a friend's username"
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
          />
          <Pressable style={styles.addBtn} onPress={() => void addInvitee()} disabled={addingInvitee}>
            <Text style={styles.addBtnText}>{addingInvitee ? "Checking..." : "Add"}</Text>
          </Pressable>
        </View>
        {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
        {inviteSuccess ? <Text style={styles.successText}>{inviteSuccess}</Text> : null}

        {invitedPeople.length === 0 ? (
          <Text style={styles.placeholderText}>No people added yet.</Text>
        ) : (
          <View style={styles.chipsWrap}>
            {invitedPeople.map((person) => (
              <View key={person.id} style={styles.personChip}>
                <Text style={styles.personChipText}>@{person.username}</Text>
                <Pressable
                  onPress={() => setInvitedPeople((prev) => prev.filter((invitee) => invitee.id !== person.id))}
                  style={styles.removeChipButton}
                >
                  <Text style={styles.removeChipButtonText}>x</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      {createEventError ? <Text style={styles.errorText}>{createEventError}</Text> : null}
      {createEventSuccess ? <Text style={styles.successText}>{createEventSuccess}</Text> : null}

      <Pressable style={[styles.primaryBtn, creatingEvent && styles.primaryBtnDisabled]} onPress={handleCreateEvent} disabled={creatingEvent}>
        <Text style={styles.primaryBtnText}>
          {creatingEvent ? "Creating..." : visibility === "Public" ? "Publish event" : "Create event"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6fb" },
  content: { padding: 20, paddingBottom: 28 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 14, color: "#1a2233" },
  card: {
    borderWidth: 1,
    borderColor: "#d9e2f3",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#ffffff",
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8, color: "#1a2233" },
  cardText: { fontSize: 14, color: "#4f5f78", marginBottom: 4 },
  settingLabel: { fontSize: 14, fontWeight: "700", color: "#1a2233", marginTop: 8, marginBottom: 8 },
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8e1f2",
    backgroundColor: "#f7f9fd",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  optionChipActive: {
    backgroundColor: "#1f4fa3",
    borderColor: "#1f4fa3",
  },
  optionChipText: {
    fontSize: 12,
    color: "#4c5e7b",
    fontWeight: "600",
  },
  optionChipTextActive: {
    color: "#ffffff",
  },
  inlineSettingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 10,
  },
  inlineSettingText: { flex: 1, fontSize: 13, color: "#33415c" },
  smallToggle: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d8e1f2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f7f9fd",
  },
  smallToggleActive: {
    backgroundColor: "#1f4fa3",
    borderColor: "#1f4fa3",
  },
  smallToggleText: { color: "#4c5e7b", fontWeight: "700", fontSize: 12 },
  smallToggleTextActive: { color: "#ffffff" },
  inviteRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d8e1f2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1a2233",
  },
  addBtn: {
    backgroundColor: "#1f4fa3",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnText: { color: "#ffffff", fontWeight: "700" },
  placeholderText: { marginTop: 10, fontSize: 13, color: "#6b7a90" },
  chipsWrap: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  personChip: {
    backgroundColor: "#eef3fb",
    borderWidth: 1,
    borderColor: "#d8e1f2",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  personChipText: { color: "#33415c", fontSize: 12, fontWeight: "600" },
  removeChipButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#d4deef",
    alignItems: "center",
    justifyContent: "center",
  },
  removeChipButtonText: { color: "#33415c", fontSize: 11, fontWeight: "700" },
  primaryBtn: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#111",
  },
  primaryBtnDisabled: { backgroundColor: "#777" },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  errorText: { color: "#b00020", marginBottom: 8 },
  successText: { color: "#2f7d32", marginBottom: 8 },
});
