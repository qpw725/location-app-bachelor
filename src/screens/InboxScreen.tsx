import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, RefreshControl, Modal } from "react-native";
import { supabase } from "../supabase";

type InboxItemStatus = "pending" | "accepted" | "declined";

type EventInviteItem = {
  id: string;
  title: string;
  when: string;
  where: string;
  from: string;
  status: InboxItemStatus;
};

type FriendRequestItem = {
  id: string;
  senderId: string;
  name: string;
  username: string;
  mutuals: number;
  status: InboxItemStatus;
};

type FriendItem = {
  id: string;
  name: string;
  username: string;
  createdAt: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
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

function fullNameFromProfile(profile: ProfileRow) {
  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  const fullName = `${first} ${last}`.trim();
  return fullName || profile.username?.trim() || "Unknown user";
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
  const handledEventInvites = useMemo(
    () => eventInvites.filter((invite) => invite.status !== "pending"),
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
        .select("id, username, first_name, last_name")
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
          mutuals: 0,
          status: request.status,
        };
      })
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
      .select("id, username, first_name, last_name, created_at")
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

  function updateEventInviteStatus(id: string, status: Exclude<InboxItemStatus, "pending">) {
    setEventInvites((prev) => prev.map((invite) => (invite.id === id ? { ...invite, status } : invite)));
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
      style={styles.container}
      contentContainerStyle={styles.content}
      alwaysBounceVertical
      overScrollMode="always"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>INBOX</Text>
        <Text style={styles.heroTitle}>Your updates in one place</Text>
        <Text style={styles.heroSubtitle}>
          {pendingEventInvites.length + pendingFriendRequests.length} actions waiting
        </Text>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

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
              <Text style={styles.inviteHost}>{invite.from}</Text>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => updateEventInviteStatus(invite.id, "accepted")}
                  style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryActionText}>Accept</Text>
                </Pressable>
                <Pressable
                  onPress={() => updateEventInviteStatus(invite.id, "declined")}
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
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{request.name.charAt(0).toUpperCase()}</Text>
              </View>
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
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{friend.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.friendTextWrap}>
                <Text style={styles.friendName}>{friend.name}</Text>
                <Text style={styles.friendUsername}>@{friend.username}</Text>
              </View>
              <Text style={styles.friendArrow}>{">"}</Text>
            </Pressable>
          ))
        )}
      </View>

      {handledEventInvites.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recently Handled</Text>
          {handledEventInvites.map((invite) => (
            <View key={invite.id} style={styles.historyRow}>
              <Text style={styles.historyTitle}>{invite.title}</Text>
              <Text style={[styles.historyBadge, invite.status === "accepted" ? styles.accepted : styles.declined]}>
                {invite.status === "accepted" ? "Accepted" : "Declined"}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Modal
        visible={selectedFriend !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedFriend(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedFriend(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
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
  container: { flex: 1, backgroundColor: "#f4f6fb" },
  content: { padding: 20, paddingBottom: 28 },
  hero: {
    backgroundColor: "#10264a",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  heroEyebrow: {
    color: "#9fb7db",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroTitle: { color: "#ffffff", fontSize: 28, fontWeight: "800", marginBottom: 4 },
  heroSubtitle: { color: "#d7e3f6", fontSize: 14 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#1a2233", marginBottom: 10 },
  inviteCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    padding: 14,
    marginBottom: 10,
  },
  inviteTitle: { fontSize: 17, fontWeight: "700", color: "#1a2233", marginBottom: 4 },
  inviteMeta: { fontSize: 13, color: "#5d6a80", marginBottom: 1 },
  inviteHost: { fontSize: 13, color: "#3f4e68", marginTop: 6, marginBottom: 10 },
  actionRow: { flexDirection: "row", gap: 8 },
  primaryAction: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#1f4fa3",
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryActionText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  secondaryAction: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d9e2f3",
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryActionText: { color: "#1f4fa3", fontWeight: "700", fontSize: 13 },
  friendRequestCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  friendRequestBody: { flex: 1 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#d8e1f2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: { color: "#1a2233", fontSize: 14, fontWeight: "700" },
  friendName: { fontSize: 16, fontWeight: "700", color: "#1a2233" },
  mutualText: { fontSize: 12, color: "#5d6a80", marginTop: 2, marginBottom: 8 },
  searchCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    padding: 10,
  },
  searchRow: { flexDirection: "row", alignItems: "center" },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1a2233",
    borderWidth: 1,
    borderColor: "#d8e1f2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    backgroundColor: "#f9fbff",
  },
  searchButton: {
    borderRadius: 10,
    backgroundColor: "#1f4fa3",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchButtonText: { color: "#ffffff", fontWeight: "700" },
  friendCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  friendTextWrap: { flex: 1 },
  friendUsername: { fontSize: 12, color: "#5d6a80", marginTop: 2 },
  friendArrow: { fontSize: 22, color: "#1a2233", marginLeft: 8 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e4eaf5",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  historyTitle: { fontSize: 14, color: "#1a2233", fontWeight: "600", flex: 1, paddingRight: 8 },
  historyBadge: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  accepted: { color: "#2f7d32", backgroundColor: "#ecf7ee" },
  declined: { color: "#a23d3d", backgroundColor: "#fcecec" },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    padding: 12,
  },
  emptyText: { fontSize: 13, color: "#73819a" },
  loadingWrap: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    padding: 14,
    alignItems: "center",
  },
  errorText: {
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: "#fcecec",
    color: "#a23d3d",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "600",
  },
  successText: {
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: "#ecf7ee",
    color: "#2f7d32",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 17, 33, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dce5f5",
    padding: 18,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1a2233",
  },
  modalUsername: {
    fontSize: 14,
    color: "#5d6a80",
    marginTop: 2,
    marginBottom: 14,
  },
  modalInfoBlock: {
    marginTop: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#edf1f8",
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5d6a80",
    marginBottom: 3,
  },
  modalValue: {
    fontSize: 15,
    color: "#1a2233",
    fontWeight: "600",
  },
  modalCloseButton: {
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: "#1f4fa3",
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
    borderRadius: 10,
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
