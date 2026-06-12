import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Switch,
} from "react-native";
import { CommonActions } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EventInvitee, RootStackParamList } from "../../../App";
import ProfileAvatar from "../../components/ProfileAvatar";
import { getAvatarPublicUrl, getProfileInitials } from "../../profile";
import StepIndicator from "../../components/StepIndicator";
import { supabase } from "../../supabase";
import { colors, commonStyles } from "../../styles/common";

type Props = NativeStackScreenProps<RootStackParamList, "CreateEventInvite">;

type FriendSuggestion = {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
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

export default function CreateEventInviteScreen({ route, navigation }: Props) {
  const { eventName, eventDescription, location, eventTime, eventEndTime, eventDate } = route.params;

  const [visibility, setVisibility] = useState<"Private" | "Public">("Private");
  const [selectedCategory, setSelectedCategory] = useState(categoryOptions[0]);
  const [attendanceCountingEnabled, setAttendanceCountingEnabled] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [invitedPeople, setInvitedPeople] = useState<EventInvitee[]>([]);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [addingInvitee, setAddingInvitee] = useState(false);
  const [friendSuggestions, setFriendSuggestions] = useState<FriendSuggestion[]>([]);
  const [loadingFriendSuggestions, setLoadingFriendSuggestions] = useState(true);
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

  const availableFriendSuggestions = useMemo(() => {
    const invitedIds = new Set(invitedPeople.map((person) => person.id));
    const query = inviteInput.trim().toLowerCase();

    return friendSuggestions.filter((friend) => {
      if (invitedIds.has(friend.id)) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        friend.username.toLowerCase().includes(query) ||
        friend.name.toLowerCase().includes(query)
      );
    });
  }, [friendSuggestions, inviteInput, invitedPeople]);

  useEffect(() => {
    let isMounted = true;

    async function loadFriendSuggestions() {
      setLoadingFriendSuggestions(true);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        if (isMounted) {
          setLoadingFriendSuggestions(false);
        }
        return;
      }

      const activeUserId = userData.user.id;

      const { data: friendshipRows, error: friendshipsError } = await supabase
        .from("friendships")
        .select("user_a, user_b")
        .or(`user_a.eq.${activeUserId},user_b.eq.${activeUserId}`);

      if (friendshipsError) {
        if (isMounted) {
          setLoadingFriendSuggestions(false);
        }
        return;
      }

      const friendIds = (friendshipRows ?? [])
        .map((row) => (row.user_a === activeUserId ? row.user_b : row.user_a))
        .filter((id) => id !== activeUserId);

      if (friendIds.length === 0) {
        if (isMounted) {
          setFriendSuggestions([]);
          setLoadingFriendSuggestions(false);
        }
        return;
      }

      const { data: friendProfiles, error: friendProfilesError } = await supabase
        .from("profiles")
        .select("id, username, first_name, last_name, avatar_path")
        .in("id", friendIds);

      if (friendProfilesError) {
        if (isMounted) {
          setLoadingFriendSuggestions(false);
        }
        return;
      }

      const suggestions = (friendProfiles ?? [])
        .filter((profile) => !!profile.username)
        .map((profile) => {
          const firstName = profile.first_name?.trim() ?? "";
          const lastName = profile.last_name?.trim() ?? "";
          const fullName = `${firstName} ${lastName}`.trim();

          return {
            id: profile.id,
            username: profile.username?.trim() ?? "",
            name: fullName || profile.username?.trim() || "Unknown user",
            avatarUrl: getAvatarPublicUrl(profile.avatar_path?.trim() || null),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      if (isMounted) {
        setFriendSuggestions(suggestions);
        setLoadingFriendSuggestions(false);
      }
    }

    void loadFriendSuggestions();

    return () => {
      isMounted = false;
    };
  }, []);

  function addSuggestedFriend(friend: FriendSuggestion) {
    setInviteError(null);
    setInviteSuccess(`@${friend.username} added to invite list.`);
    setInvitedPeople((prev) => {
      if (prev.some((person) => person.id === friend.id)) {
        return prev;
      }

      return [...prev, { id: friend.id, username: friend.username, name: friend.name, avatarUrl: friend.avatarUrl }];
    });
  }

  function removeInvitee(person: EventInvitee) {
    setInvitedPeople((prev) => prev.filter((invitee) => invitee.id !== person.id));
    setInviteSuccess(null);
    setInviteError(`@${person.username} removed from invite list.`);
  }

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
      .select("id, username, first_name, last_name, avatar_path")
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

    const username = friendProfile.username.trim();
    const firstName = friendProfile.first_name?.trim() ?? "";
    const lastName = friendProfile.last_name?.trim() ?? "";
    const fullName = `${firstName} ${lastName}`.trim();
    const inviteeName = fullName || username;
    const avatarUrl = getAvatarPublicUrl(friendProfile.avatar_path?.trim() || null);
    setInvitedPeople((prev) => {
      if (prev.some((person) => person.id === friendProfile.id)) {
        return prev;
      }
      return [...prev, { id: friendProfile.id, username, name: inviteeName, avatarUrl }];
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
        attendance_enabled: false,
        attendance_method: null,
        attendance_radius_meters: null,
        live_map_enabled: false,
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
        routes: [{ name: "MainTabs", params: { screen: "MyEvents" } }],
      })
    );
  }

  function continueWithAttendanceSetup() {
    navigation.navigate("CreateEventAttendance", {
      eventName,
      eventDescription,
      location,
      eventTime,
      eventEndTime,
      eventDate,
      visibility,
      selectedCategory,
      invitedPeople,
    });
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
        <StepIndicator step={3} total={attendanceCountingEnabled ? 4 : 3} label="Finalize" />

        <View style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>Event summary</Text>
          <Text style={styles.cardText}>Title: {eventName}</Text>
          {eventDescription?.trim() ? <Text style={styles.cardText}>Description: {eventDescription}</Text> : null}
          <Text style={styles.cardText}>Location: {locationLabel}</Text>
          <Text style={styles.cardText}>Date: {eventDateLabel}</Text>
          <Text style={styles.cardText}>Start: {eventStartTimeLabel}</Text>
          <Text style={styles.cardText}>End: {eventEndTimeLabel}</Text>
        </View>

        <View style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>Event settings</Text>

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

          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.switchTitle}>GPS features</Text>
              <Text style={styles.switchDescription}>
                Configure presence detection, trigger rules and live map features for this event.
              </Text>
            </View>
            <Switch
              value={attendanceCountingEnabled}
              onValueChange={setAttendanceCountingEnabled}
              trackColor={{ false: "#d8c7b3", true: "#b8d2c4" }}
              thumbColor={attendanceCountingEnabled ? colors.primary : colors.surface}
            />
          </View>
        </View>

        <View style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>Invite people</Text>
          <View style={styles.inviteRow}>
            <TextInput
              value={inviteInput}
              onChangeText={setInviteInput}
              placeholder="Add a username"
              placeholderTextColor="#8a7f74"
              style={styles.input}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
            />
            <Pressable style={[styles.addBtn, addingInvitee && styles.primaryBtnDisabled]} onPress={() => void addInvitee()} disabled={addingInvitee}>
              <Text style={styles.addBtnText}>{addingInvitee ? "Checking..." : "Add"}</Text>
            </Pressable>
          </View>
          {inviteError ? <Text style={commonStyles.errorText}>{inviteError}</Text> : null}
          {inviteSuccess ? <Text style={commonStyles.successText}>{inviteSuccess}</Text> : null}

          {invitedPeople.length > 0 ? (
            <View style={styles.chipsWrap}>
              {invitedPeople.map((person) => (
                <View key={person.id} style={styles.personChip}>
                  <ProfileAvatar
                    avatarUrl={person.avatarUrl ?? null}
                    initials={getProfileInitials(person.name ?? person.username, person.username)}
                    size={24}
                  />
                  <Text style={styles.personChipText}>@{person.username}</Text>
                  <Pressable
                    onPress={() => removeInvitee(person)}
                    style={styles.removeChipButton}
                  >
                    <Text style={styles.removeChipButtonText}>x</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.suggestionSection}>
            <Text style={styles.suggestionTitle}>Friends</Text>
            {loadingFriendSuggestions ? (
              <Text style={styles.placeholderText}>Loading friends...</Text>
            ) : availableFriendSuggestions.length === 0 ? (
              <Text style={styles.placeholderText}>
                {friendSuggestions.length === 0
                  ? "No friends added yet."
                  : inviteInput.trim().length > 0
                    ? "No friend matches that search."
                    : "All available friends have been added."}
              </Text>
            ) : (
              <View style={styles.suggestionList}>
                {availableFriendSuggestions.map((friend) => (
                  <Pressable
                    key={friend.id}
                    onPress={() => addSuggestedFriend(friend)}
                    style={({ pressed }) => [styles.suggestionRow, pressed && styles.suggestionRowPressed]}
                  >
                    <ProfileAvatar
                      avatarUrl={friend.avatarUrl}
                      initials={getProfileInitials(friend.name, friend.username)}
                      size={34}
                    />
                    <View style={styles.suggestionTextWrap}>
                      <Text style={styles.suggestionName}>{friend.name}</Text>
                      <Text style={styles.suggestionUsername}>@{friend.username}</Text>
                    </View>
                    <Text style={styles.suggestionAction}>Add</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>

        {createEventError ? <Text style={commonStyles.errorText}>{createEventError}</Text> : null}
        {createEventSuccess ? <Text style={commonStyles.successText}>{createEventSuccess}</Text> : null}

        <Pressable
          style={[commonStyles.primaryButton, creatingEvent && styles.primaryBtnDisabled]}
          onPress={attendanceCountingEnabled ? continueWithAttendanceSetup : handleCreateEvent}
          disabled={creatingEvent}
        >
          <Text style={commonStyles.primaryButtonText}>
            {creatingEvent
              ? "Creating..."
              : attendanceCountingEnabled
                ? "Configure GPS features"
                : visibility === "Public"
                  ? "Publish event"
                  : "Create event"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  cardText: { fontSize: 14, color: "#5f5145", marginBottom: 6, lineHeight: 20 },
  settingLabel: { fontSize: 14, fontWeight: "700", color: "#201c19", marginTop: 8, marginBottom: 8 },
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eadfce",
    backgroundColor: "#f6eee4",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionChipActive: {
    backgroundColor: "#2f5d50",
    borderColor: "#2f5d50",
  },
  optionChipText: {
    fontSize: 12,
    color: "#5f5145",
    fontWeight: "700",
  },
  optionChipTextActive: {
    color: "#ffffff",
  },
  helperText: {
    color: "#6f6258",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#efe4d7",
    marginTop: 14,
    paddingTop: 14,
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
  inviteRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: "#201c19",
    backgroundColor: "#fffaf4",
  },
  addBtn: {
    backgroundColor: "#2f5d50",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addBtnText: { color: "#ffffff", fontWeight: "700" },
  placeholderText: { marginTop: 10, fontSize: 13, color: "#6f6258" },
  suggestionSection: { marginTop: 10 },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4f4339",
    marginBottom: 10,
  },
  suggestionList: {
    maxHeight: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eadfce",
    overflow: "hidden",
    backgroundColor: "#fff6ea",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#efe4d7",
    backgroundColor: "#fffaf4",
  },
  suggestionRowPressed: {
    opacity: 0.86,
  },
  suggestionTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  suggestionName: {
    color: "#201c19",
    fontSize: 14,
    fontWeight: "700",
  },
  suggestionUsername: {
    color: "#6f6258",
    fontSize: 12,
    marginTop: 2,
  },
  suggestionAction: {
    color: "#2f5d50",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 10,
  },
  chipsWrap: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  personChip: {
    backgroundColor: "#fff6ea",
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  personChipText: { color: "#4f4339", fontSize: 12, fontWeight: "600" },
  removeChipButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e2c8ad",
    alignItems: "center",
    justifyContent: "center",
  },
  removeChipButtonText: { color: "#4f4339", fontSize: 16, fontWeight: "900", lineHeight: 18 },
  primaryBtnDisabled: { opacity: 0.7 },
});
