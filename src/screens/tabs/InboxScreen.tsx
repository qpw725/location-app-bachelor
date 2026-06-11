import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, RefreshControl, Modal } from "react-native";
import ProfileAvatar from "../../components/ProfileAvatar";
import { getAvatarPublicUrl, getProfileInitials } from "../../profile";
import { supabase } from "../../supabase";
import { commonStyles } from "../../styles/common";

type InboxItemStatus = "pending" | "accepted" | "declined";

type EventInviteItem = {
  id: string;
  eventId: string;
  title: string;
  when: string;
  where: string;
  from: string;
  fromUsername: string;
  fromAvatarUrl: string | null;
  status: InboxItemStatus;
};

type FriendRequestItem = {
  id: string;
  senderId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  mutuals: number;
  status: InboxItemStatus;
};

type FriendItem = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  createdAt: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
  created_at?: string | null;
};

type FriendRequestRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: InboxItemStatus;
};

type FriendshipRow = {
  user_a: string;
  user_b: string;
};

type EventInviteRow = {
  event_id: string;
  invitee_id: string;
  status: InboxItemStatus;
};

type EventRow = {
  id: string;
  title: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  ended_at: string | null;
  creator_id: string | null;
};

function fullNameFromProfile(profile: ProfileRow) {
  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  const fullName = `${first} ${last}`.trim();
  return fullName || profile.username?.trim() || "Unknown user";
}

function formatEventTime(startIso: string | null, endIso: string | null) {
  if (!startIso) {
    return "Time not set";
  }
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const dateLabel = start.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" });
  const startLabel = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (!end) {
    return `${dateLabel} at ${startLabel}`;
  }
  const endLabel = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${dateLabel} ${startLabel} - ${endLabel}`;
}

function isEndedEvent(event: Pick<EventRow, "end_time" | "status" | "ended_at">, now = Date.now()) {
  if (event.status?.toLowerCase() === "ended") {
    return true;
  }

  const endedMs = event.ended_at ? new Date(event.ended_at).getTime() : NaN;
  if (Number.isFinite(endedMs) && endedMs <= now) {
    return true;
  }

  const endMs = event.end_time ? new Date(event.end_time).getTime() : NaN;
  return Number.isFinite(endMs) && endMs <= now;
}

export default function InboxScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [eventInvites, setEventInvites] = useState<EventInviteItem[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequestItem[]>([]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loadingSocialData, setLoadingSocialData] = useState(true);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<FriendItem | null>(null);
  const [removingFriend, setRemovingFriend] = useState(false);

  const pendingEventInvites = useMemo(
    () => eventInvites.filter((invite) => invite.status === "pending"),
    [eventInvites]
  );
  const pendingFriendRequests = useMemo(
    () => friendRequests.filter((request) => request.status === "pending"),
    [friendRequests]
  );

  const ensureCurrentUserProfile = useCallback(async (activeUserId: string) => {
    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", activeUserId)
      .maybeSingle();

    if (existingProfileError) {
      setErrorMessage(existingProfileError.message);
      return false;
    }

    if (existingProfile) {
      return true;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setErrorMessage(userError?.message ?? "Unable to resolve active user.");
      return false;
    }

    const metadata = userData.user.user_metadata as
      | { username?: string; first_name?: string; last_name?: string; date_of_birth?: string }
      | undefined;

    const username = metadata?.username?.trim() ?? "";
    if (!username) {
      setErrorMessage("Your profile is missing a username. Please re-register this account.");
      return false;
    }

    const { error: createProfileError } = await supabase.from("profiles").upsert(
      {
        id: activeUserId,
        username,
        first_name: metadata?.first_name?.trim() ?? null,
        last_name: metadata?.last_name?.trim() ?? null,
        date_of_birth: metadata?.date_of_birth ?? null,
      },
      { onConflict: "id" }
    );

    if (createProfileError) {
      setErrorMessage(createProfileError.message);
      return false;
    }

    return true;
  }, []);

  const loadSocialData = useCallback(async (activeUserId: string, options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoadingSocialData(true);
    }
    setErrorMessage(null);
    setSuccessMessage(null);

    const { data: requestRows, error: requestsError } = await supabase
      .from("friend_requests")
      .select("id, sender_id, receiver_id, status")
      .eq("receiver_id", activeUserId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (requestsError) {
      setErrorMessage(requestsError.message);
      if (!silent) {
        setLoadingSocialData(false);
      }
      return;
    }

    const incomingRequests = (requestRows ?? []) as FriendRequestRow[];
    const senderIds = incomingRequests.map((request) => request.sender_id);

    const senderProfilesById = new Map<string, ProfileRow>();
    if (senderIds.length > 0) {
      const { data: senderProfiles, error: senderProfilesError } = await supabase
        .from("profiles")
        .select("id, username, first_name, last_name, avatar_path")
        .in("id", senderIds);

      if (senderProfilesError) {
        setErrorMessage(senderProfilesError.message);
        if (!silent) {
          setLoadingSocialData(false);
        }
        return;
      }

      for (const profile of (senderProfiles ?? []) as ProfileRow[]) {
        senderProfilesById.set(profile.id, profile);
      }
    }

    setFriendRequests(
      incomingRequests.map((request) => {
        const senderProfile = senderProfilesById.get(request.sender_id);
        return {
          id: request.id,
          senderId: request.sender_id,
          name: senderProfile ? fullNameFromProfile(senderProfile) : "Unknown user",
          username: senderProfile?.username?.trim() ?? "unknown",
          avatarUrl: getAvatarPublicUrl(senderProfile?.avatar_path?.trim() || null),
          mutuals: 0,
          status: request.status,
        };
      })
    );

    const { data: eventInviteRows, error: eventInvitesError } = await supabase
      .from("event_invites")
      .select("event_id, invitee_id, status")
      .eq("invitee_id", activeUserId)
      .order("created_at", { ascending: false });

    if (eventInvitesError) {
      setErrorMessage(eventInvitesError.message);
      if (!silent) {
        setLoadingSocialData(false);
      }
      return;
    }

    const eventIds = ((eventInviteRows ?? []) as EventInviteRow[]).map((invite) => invite.event_id);
    const eventMap = new Map<string, EventRow>();
    const eventHostMap = new Map<string, ProfileRow>();

    if (eventIds.length > 0) {
      const { data: eventRows, error: eventsError } = await supabase
        .from("events")
        .select("id, title, location, start_time, end_time, status, ended_at, creator_id")
        .in("id", eventIds);

      if (eventsError) {
        setErrorMessage(eventsError.message);
        if (!silent) {
          setLoadingSocialData(false);
        }
        return;
      }

      for (const event of (eventRows ?? []) as EventRow[]) {
        eventMap.set(event.id, event);
      }

      const creatorIds = Array.from(new Set(((eventRows ?? []) as EventRow[]).map((event) => event.creator_id).filter(Boolean))) as string[];
      if (creatorIds.length > 0) {
        const { data: hostProfiles, error: hostProfilesError } = await supabase
          .from("profiles")
          .select("id, username, first_name, last_name, avatar_path")
          .in("id", creatorIds);

        if (hostProfilesError) {
          setErrorMessage(hostProfilesError.message);
          if (!silent) {
            setLoadingSocialData(false);
          }
          return;
        }

        for (const profile of (hostProfiles ?? []) as ProfileRow[]) {
          eventHostMap.set(profile.id, profile);
        }
      }
    }

    setEventInvites(
      ((eventInviteRows ?? []) as EventInviteRow[])
        .map((invite) => {
          const event = eventMap.get(invite.event_id);
          if (!event || isEndedEvent(event)) {
            return null;
          }

          const hostProfile = event.creator_id ? eventHostMap.get(event.creator_id) : undefined;
          return {
            id: `${invite.event_id}:${invite.invitee_id}`,
            eventId: invite.event_id,
            title: event.title?.trim() || "Untitled event",
            when: formatEventTime(event.start_time, event.end_time),
            where: event.location?.trim() || "Location not set",
            from: hostProfile ? fullNameFromProfile(hostProfile) : "Unknown host",
            fromUsername: hostProfile?.username?.trim() ?? "",
            fromAvatarUrl: getAvatarPublicUrl(hostProfile?.avatar_path?.trim() || null),
            status: invite.status,
          };
        })
        .filter((invite): invite is EventInviteItem => invite !== null)
    );

    const { data: friendshipRows, error: friendshipsError } = await supabase
      .from("friendships")
      .select("user_a, user_b")
      .or(`user_a.eq.${activeUserId},user_b.eq.${activeUserId}`);

    if (friendshipsError) {
      setErrorMessage(friendshipsError.message);
      if (!silent) {
        setLoadingSocialData(false);
      }
      return;
    }

    const friendIds = ((friendshipRows ?? []) as FriendshipRow[])
      .map((row) => (row.user_a === activeUserId ? row.user_b : row.user_a))
      .filter((id) => id !== activeUserId);

    if (friendIds.length === 0) {
      setFriends([]);
      if (!silent) {
        setLoadingSocialData(false);
      }
      return;
    }

    const { data: friendProfiles, error: friendProfilesError } = await supabase
      .from("profiles")
      .select("id, username, first_name, last_name, avatar_path, created_at")
      .in("id", friendIds);

    if (friendProfilesError) {
      setErrorMessage(friendProfilesError.message);
      if (!silent) {
        setLoadingSocialData(false);
      }
      return;
    }

    const orderedFriends = ((friendProfiles ?? []) as ProfileRow[])
      .map((profile) => ({
        id: profile.id,
        name: fullNameFromProfile(profile),
        username: profile.username?.trim() ?? "",
        avatarUrl: getAvatarPublicUrl(profile.avatar_path?.trim() || null),
        createdAt: profile.created_at ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    setFriends(orderedFriends);
    if (!silent) {
      setLoadingSocialData(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!userId) {
      return;
    }

    setRefreshing(true);
    await loadSocialData(userId);
    setRefreshing(false);
  }, [loadSocialData, userId]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (error) {
        setErrorMessage(error.message);
        setLoadingSocialData(false);
        return;
      }

      const activeUserId = data.user?.id ?? null;
      setUserId(activeUserId);

      if (!activeUserId) {
        setErrorMessage("You must be logged in to use inbox actions.");
        setLoadingSocialData(false);
        return;
      }

      const ensured = await ensureCurrentUserProfile(activeUserId);
      if (!ensured) {
        setLoadingSocialData(false);
        return;
      }

      await loadSocialData(activeUserId);
    });
  }, [ensureCurrentUserProfile, loadSocialData]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const intervalId = setInterval(() => {
      void loadSocialData(userId, { silent: true });
    }, 60000);

    return () => clearInterval(intervalId);
  }, [loadSocialData, userId]);

  async function updateEventInviteStatus(eventId: string, status: Exclude<InboxItemStatus, "pending">) {
    if (!userId) {
      setErrorMessage("You must be logged in to respond to invites.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    if (status === "accepted") {
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("id, start_time, end_time, status, ended_at")
        .eq("id", eventId)
        .maybeSingle<EventRow>();

      if (eventError) {
        setErrorMessage(eventError.message);
        return;
      }

      if (!event || isEndedEvent(event)) {
        setErrorMessage("This event has already ended.");
        await loadSocialData(userId);
        return;
      }
    }

    const { error } = await supabase
      .from("event_invites")
      .update({ status })
      .eq("event_id", eventId)
      .eq("invitee_id", userId)
      .eq("status", "pending");

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage(status === "accepted" ? "Event invite accepted." : "Event invite declined.");
    await loadSocialData(userId);
  }

  async function updateFriendRequestStatus(id: string, status: Exclude<InboxItemStatus, "pending">) {
    if (!userId) {
      setErrorMessage("You must be logged in to respond to requests.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const targetRequest = friendRequests.find((request) => request.id === id);
    if (!targetRequest) {
      setErrorMessage("Friend request not found.");
      return;
    }

    const { error: updateError } = await supabase
      .from("friend_requests")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", id)
      .eq("receiver_id", userId)
      .eq("status", "pending");

    if (updateError) {
      setErrorMessage(updateError.message);
      return;
    }

    if (status === "accepted") {
      const [userA, userB] = [userId, targetRequest.senderId].sort();
      const { error: friendshipError } = await supabase
        .from("friendships")
        .upsert(
          [
            {
              user_a: userA,
              user_b: userB,
            },
          ],
          { onConflict: "user_a,user_b", ignoreDuplicates: true }
        );

      if (friendshipError) {
        setErrorMessage(friendshipError.message);
        return;
      }
    }

    setSuccessMessage(status === "accepted" ? "Friend request accepted." : "Friend request ignored.");
    await loadSocialData(userId);
  }

  async function handleSendFriendRequest() {
    const username = searchQuery.trim();

    if (!userId) {
      setErrorMessage("You must be logged in to send requests.");
      return;
    }

    const ensured = await ensureCurrentUserProfile(userId);
    if (!ensured) {
      setSendingRequest(false);
      return;
    }

    if (!username) {
      setErrorMessage("Enter a username first.");
      return;
    }

    setSendingRequest(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { data: receiverProfile, error: receiverLookupError } = await supabase
      .from("profiles")
      .select("id, username, first_name, last_name")
      .ilike("username", username)
      .limit(1)
      .maybeSingle();

    if (receiverLookupError) {
      setErrorMessage(receiverLookupError.message);
      setSendingRequest(false);
      return;
    }

    if (!receiverProfile) {
      setErrorMessage("No user found with that username.");
      setSendingRequest(false);
      return;
    }

    if (receiverProfile.id === userId) {
      setErrorMessage("You cannot send a friend request to yourself.");
      setSendingRequest(false);
      return;
    }

    const [userA, userB] = [userId, receiverProfile.id].sort();
    const { data: existingFriendship, error: existingFriendshipError } = await supabase
      .from("friendships")
      .select("user_a")
      .eq("user_a", userA)
      .eq("user_b", userB)
      .maybeSingle();

    if (existingFriendshipError) {
      setErrorMessage(existingFriendshipError.message);
      setSendingRequest(false);
      return;
    }

    if (existingFriendship) {
      setErrorMessage("You are already friends with this user.");
      setSendingRequest(false);
      return;
    }

    const { data: outgoingPending, error: outgoingPendingError } = await supabase
      .from("friend_requests")
      .select("id")
      .eq("sender_id", userId)
      .eq("receiver_id", receiverProfile.id)
      .eq("status", "pending")
      .maybeSingle();

    if (outgoingPendingError) {
      setErrorMessage(outgoingPendingError.message);
      setSendingRequest(false);
      return;
    }

    if (outgoingPending) {
      setErrorMessage("Friend request already sent.");
      setSendingRequest(false);
      return;
    }

    const { data: incomingPending, error: incomingPendingError } = await supabase
      .from("friend_requests")
      .select("id")
      .eq("sender_id", receiverProfile.id)
      .eq("receiver_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (incomingPendingError) {
      setErrorMessage(incomingPendingError.message);
      setSendingRequest(false);
      return;
    }

    if (incomingPending) {
      setErrorMessage("This user already sent you a request. Accept it from Friend Requests.");
      setSendingRequest(false);
      return;
    }

    const { error: insertError } = await supabase.from("friend_requests").insert({
      sender_id: userId,
      receiver_id: receiverProfile.id,
      status: "pending",
    });

    if (insertError) {
      setErrorMessage(insertError.message);
      setSendingRequest(false);
      return;
    }

    setSuccessMessage(`Request sent to @${receiverProfile.username ?? username}.`);
    setSearchQuery("");
    setSendingRequest(false);
  }

  async function handleRemoveFriend() {
    if (!userId || !selectedFriend) {
      return;
    }

    setRemovingFriend(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { data: deletedRows, error } = await supabase
      .from("friendships")
      .delete()
      .or(
        `and(user_a.eq.${userId},user_b.eq.${selectedFriend.id}),and(user_a.eq.${selectedFriend.id},user_b.eq.${userId})`
      )
      .select("user_a, user_b");

    if (error) {
      setErrorMessage(error.message);
      setRemovingFriend(false);
      return;
    }

    if (!deletedRows || deletedRows.length === 0) {
      setErrorMessage("Could not remove friend. Check friendships DELETE policy (RLS).");
      setRemovingFriend(false);
      return;
    }

    setSelectedFriend(null);
    setSuccessMessage("Friend removed.");
    await loadSocialData(userId);
    setRemovingFriend(false);
  }

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      alwaysBounceVertical
      overScrollMode="always"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
    >
      {errorMessage ? <Text style={commonStyles.errorText}>{errorMessage}</Text> : null}
      {successMessage ? <Text style={commonStyles.successText}>{successMessage}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Event Invites</Text>
        {pendingEventInvites.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No pending invites right now.</Text>
          </View>
        ) : (
          pendingEventInvites.map((invite) => (
            <View key={invite.id} style={styles.inviteCard}>
              <Text style={styles.inviteTitle}>{invite.title}</Text>
              <Text style={styles.inviteMeta}>{invite.when}</Text>
              <Text style={styles.inviteMeta}>{invite.where}</Text>
              <View style={styles.inviteHostRow}>
                <ProfileAvatar
                  avatarUrl={invite.fromAvatarUrl}
                  initials={getProfileInitials(invite.from, invite.fromUsername)}
                  size={34}
                />
                <View style={styles.inviteHostTextWrap}>
                  <Text style={styles.inviteHost}>{invite.from}</Text>
                  {invite.fromUsername ? <Text style={styles.inviteHostUsername}>@{invite.fromUsername}</Text> : null}
                </View>
              </View>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => void updateEventInviteStatus(invite.eventId, "accepted")}
                  style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryActionText}>Accept</Text>
                </Pressable>
                <Pressable
                  onPress={() => void updateEventInviteStatus(invite.eventId, "declined")}
                  style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryActionText}>Decline</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Friend Requests</Text>
        {loadingSocialData ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" />
          </View>
        ) : pendingFriendRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No pending friend requests.</Text>
          </View>
        ) : (
          pendingFriendRequests.map((request) => (
            <View key={request.id} style={styles.friendRequestCard}>
              <ProfileAvatar
                avatarUrl={request.avatarUrl}
                initials={getProfileInitials(request.name, request.username)}
                size={38}
              />
              <View style={styles.friendRequestBody}>
                <Text style={styles.friendName}>{request.name}</Text>
                <Text style={styles.mutualText}>@{request.username}</Text>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => void updateFriendRequestStatus(request.id, "accepted")}
                    style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
                  >
                    <Text style={styles.primaryActionText}>Accept</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void updateFriendRequestStatus(request.id, "declined")}
                    style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
                  >
                    <Text style={styles.secondaryActionText}>Ignore</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add Friends</Text>
        <View style={styles.searchCard}>
          <View style={styles.searchRow}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search username..."
              placeholderTextColor="#7a869b"
              style={styles.searchInput}
              autoCapitalize="none"
            />
            <Pressable
              onPress={() => void handleSendFriendRequest()}
              disabled={sendingRequest}
              style={({ pressed }) => [styles.searchButton, (pressed || sendingRequest) && styles.pressed]}
            >
              <Text style={styles.searchButtonText}>{sendingRequest ? "Sending..." : "Send"}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Friends</Text>
        {loadingSocialData ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" />
          </View>
        ) : friends.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No friends added yet.</Text>
          </View>
        ) : (
          friends.map((friend) => (
            <Pressable
              key={friend.id}
              onPress={() => setSelectedFriend(friend)}
              style={({ pressed }) => [styles.friendCard, pressed && styles.pressed]}
            >
              <ProfileAvatar
                avatarUrl={friend.avatarUrl}
                initials={getProfileInitials(friend.name, friend.username)}
                size={38}
              />
              <View style={styles.friendTextWrap}>
                <Text style={styles.friendName}>{friend.name}</Text>
                <Text style={styles.friendUsername}>@{friend.username}</Text>
              </View>
            </Pressable>
          ))
        )}
      </View>

      <Modal
        visible={selectedFriend !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedFriend(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedFriend(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {selectedFriend ? (
              <View style={styles.modalAvatarWrap}>
                <ProfileAvatar
                  avatarUrl={selectedFriend.avatarUrl}
                  initials={getProfileInitials(selectedFriend.name, selectedFriend.username)}
                  size={72}
                />
              </View>
            ) : null}
            <Text style={styles.modalTitle}>{selectedFriend?.name}</Text>
            <Text style={styles.modalUsername}>@{selectedFriend?.username}</Text>

            <View style={styles.modalInfoBlock}>
              <Text style={styles.modalLabel}>Account created</Text>
              <Text style={styles.modalValue}>
                {selectedFriend?.createdAt
                  ? new Date(selectedFriend.createdAt).toLocaleDateString([], {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "Unknown"}
              </Text>
            </View>

            <View style={styles.modalInfoBlock}>
              <Text style={styles.modalLabel}>Location</Text>
              <Text style={styles.modalValue}>Location not set yet</Text>
            </View>

            <Pressable
              onPress={() => void handleRemoveFriend()}
              disabled={removingFriend}
              style={({ pressed }) => [
                styles.modalDangerButton,
                (pressed || removingFriend) && styles.pressed,
              ]}
            >
              <Text style={styles.modalDangerButtonText}>
                {removingFriend ? "Removing..." : "Remove friend"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedFriend(null)}
              style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#201c19", marginBottom: 10 },
  inviteCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 16,
    marginBottom: 12,
  },
  inviteTitle: { fontSize: 17, fontWeight: "700", color: "#241f1c", marginBottom: 4 },
  inviteMeta: { fontSize: 13, color: "#6f6258", marginBottom: 1 },
  inviteHostRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  inviteHostTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  inviteHost: { fontSize: 13, color: "#4e6258", fontWeight: "700" },
  inviteHostUsername: { fontSize: 12, color: "#6f6258", marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 8 },
  primaryAction: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#2f5d50",
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryActionText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  secondaryAction: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eadfce",
    backgroundColor: "#f6eee4",
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryActionText: { color: "#4f4339", fontWeight: "700", fontSize: 13 },
  friendRequestCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  friendRequestBody: { flex: 1, marginLeft: 10 },
  friendName: { fontSize: 16, fontWeight: "700", color: "#201c19" },
  mutualText: { fontSize: 12, color: "#6f6258", marginTop: 2, marginBottom: 8 },
  searchCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 12,
  },
  searchRow: { flexDirection: "row", alignItems: "center" },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#201c19",
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    backgroundColor: "#fffaf4",
  },
  searchButton: {
    borderRadius: 12,
    backgroundColor: "#2f5d50",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchButtonText: { color: "#ffffff", fontWeight: "700" },
  friendCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  friendTextWrap: { flex: 1, marginLeft: 10 },
  friendUsername: { fontSize: 12, color: "#6f6258", marginTop: 2 },
  emptyCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 14,
  },
  emptyText: { fontSize: 13, color: "#6f6258" },
  loadingWrap: {
    backgroundColor: "#fffaf4",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 14,
    alignItems: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 17, 33, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 18,
  },
  modalAvatarWrap: {
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#201c19",
  },
  modalUsername: {
    fontSize: 14,
    color: "#6f6258",
    marginTop: 2,
    marginBottom: 14,
  },
  modalInfoBlock: {
    marginTop: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#efe4d7",
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6f6258",
    marginBottom: 3,
  },
  modalValue: {
    fontSize: 15,
    color: "#201c19",
    fontWeight: "600",
  },
  modalCloseButton: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: "#2f5d50",
    alignItems: "center",
    paddingVertical: 11,
  },
  modalCloseButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  modalDangerButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#efbcbc",
    backgroundColor: "#fff5f5",
    alignItems: "center",
    paddingVertical: 11,
  },
  modalDangerButtonText: {
    color: "#a23d3d",
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: { opacity: 0.86 },
});
