import { useCallback, useEffect, useState } from "react";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import {
  addHostedEventInvite,
  deleteHostedEvent,
  fetchEventBuckets,
  fetchHostedEventInvitees,
  removeHostedEventInvite,
  type EventItem,
  type HostedEventInvitee,
  updateHostedEvent,
} from "../data/eventStore";
import EventAttendeeSection from "../components/EventAttendeeSection";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type EditDraft = {
  eventId: string;
  title: string;
  description: string;
  location: string;
  visibility: "Private" | "Public";
  startAt: Date;
  endAt: Date;
};

type Props = NativeStackScreenProps<RootStackParamList, "HostingEvents">;

export default function HostingEventsScreen({ navigation }: Props) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingEventId, setProcessingEventId] = useState<string | null>(null);
  const [eventToDelete, setEventToDelete] = useState<EventItem | null>(null);
  const [eventToEdit, setEventToEdit] = useState<EditDraft | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editInviteInput, setEditInviteInput] = useState("");
  const [eventInvitees, setEventInvitees] = useState<HostedEventInvitee[]>([]);
  const [loadingInvitees, setLoadingInvitees] = useState(false);
  const [addingInvitee, setAddingInvitee] = useState(false);
  const [removingInviteeId, setRemovingInviteeId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await fetchEventBuckets();
    if (fetchError || !data) {
      setError(fetchError ?? "Could not load hosting events.");
      setLoading(false);
      return;
    }
    setEvents(data.hostingEvents);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  const handleDelete = useCallback(
    async (eventId: string) => {
      setActionError(null);
      setProcessingEventId(eventId);
      const { error: deleteError } = await deleteHostedEvent(eventId);
      if (deleteError) {
        setActionError(deleteError);
        setProcessingEventId(null);
        return;
      }
      await loadEvents();
      setEventToDelete(null);
      setProcessingEventId(null);
    },
    [loadEvents]
  );

  const handleSaveEdit = useCallback(async () => {
    if (!eventToEdit) {
      return;
    }

    setActionError(null);
    setProcessingEventId(eventToEdit.eventId);
    const { error: updateError } = await updateHostedEvent({
      eventId: eventToEdit.eventId,
      description: eventToEdit.description,
      location: eventToEdit.location,
      isPrivate: eventToEdit.visibility === "Private",
      startAt: eventToEdit.startAt,
      endAt: eventToEdit.endAt,
    });

    if (updateError) {
      setActionError(updateError);
      setProcessingEventId(null);
      return;
    }

    await loadEvents();
    setEventToEdit(null);
    setShowDatePicker(false);
    setProcessingEventId(null);
  }, [eventToEdit, loadEvents]);

  function openEditModal(event: EventItem) {
    if (!event.startAt || !event.endAt) {
      return;
    }

    setActionError(null);
    setShowDatePicker(false);
    setEditInviteInput("");
    setEventInvitees([]);
    setEventToEdit({
      eventId: event.id,
      title: event.title,
      description: event.description === "No description provided" ? "" : event.description,
      location: event.place === "Location not set" ? "" : event.place,
      visibility: event.visibility,
      startAt: new Date(event.startAt),
      endAt: new Date(event.endAt),
    });
    void loadEventInvitees(event.id);
  }

  const loadEventInvitees = useCallback(async (eventId: string) => {
    setLoadingInvitees(true);
    const { data, error: inviteesError } = await fetchHostedEventInvitees(eventId);
    if (inviteesError) {
      setActionError(inviteesError);
      setLoadingInvitees(false);
      return;
    }
    setEventInvitees(data ?? []);
    setLoadingInvitees(false);
  }, []);

  const handleAddInvitee = useCallback(async () => {
    if (!eventToEdit) {
      return;
    }
    setActionError(null);
    setAddingInvitee(true);
    const { data, error: addError } = await addHostedEventInvite(eventToEdit.eventId, editInviteInput);
    if (addError) {
      setActionError(addError);
      setAddingInvitee(false);
      return;
    }
    if (data) {
      setEventInvitees((prev) => {
        const next = prev.filter((invitee) => invitee.id !== data.id).concat(data);
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
    }
    setEditInviteInput("");
    setAddingInvitee(false);
  }, [editInviteInput, eventToEdit]);

  const handleRemoveInvitee = useCallback(
    async (inviteeId: string) => {
      if (!eventToEdit) {
        return;
      }
      setActionError(null);
      setRemovingInviteeId(inviteeId);
      const { error: removeError } = await removeHostedEventInvite(eventToEdit.eventId, inviteeId);
      if (removeError) {
        setActionError(removeError);
        setRemovingInviteeId(null);
        return;
      }
      setEventInvitees((prev) => prev.filter((invitee) => invitee.id !== inviteeId));
      setRemovingInviteeId(null);
    },
    [eventToEdit]
  );

  function onEditDateChange(_event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (!selectedDate || !eventToEdit) {
      return;
    }

    const nextStart = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      eventToEdit.startAt.getHours(),
      eventToEdit.startAt.getMinutes(),
      0,
      0
    );
    const nextEnd = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      eventToEdit.endAt.getHours(),
      eventToEdit.endAt.getMinutes(),
      0,
      0
    );

    setEventToEdit({
      ...eventToEdit,
      startAt: nextStart,
      endAt: nextEnd,
    });
  }

  const formattedEditDate = eventToEdit?.startAt.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Hosting</Text>
        <Text style={styles.heroTitle}>Events you are running and managing</Text>
        <Text style={styles.heroSubtitle}>Keep tabs on details, invitees, and updates from one calm overview.</Text>
      </View>
      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="small" />
          <Text style={styles.stateText}>Loading events...</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {!loading && !error && events.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No hosted events yet</Text>
          <Text style={styles.emptyText}>Only upcoming events you create will show up here.</Text>
        </View>
      ) : null}
      {events.map((event) => (
        <View key={event.id} style={styles.eventCard}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <View style={[styles.visibilityBadge, event.visibility === "Public" ? styles.publicBadge : styles.privateBadge]}>
              <Text style={styles.visibilityText}>{event.visibility}</Text>
            </View>
          </View>
          <Text style={styles.eventDescription}>{event.description}</Text>
          <Text style={styles.eventMeta}>{event.time}</Text>
          <Text style={styles.eventMeta}>{event.place}</Text>
          <View style={styles.metaFooter}>
            <Text style={styles.metaLabel}>{event.host}</Text>
            <Text style={styles.metaLabel}>{event.genre}</Text>
          </View>
          <EventAttendeeSection eventId={event.id} />
          <View style={styles.actionRow}>
            <Pressable
              style={styles.mapButton}
              onPress={() => navigation.navigate("EventMap", { eventId: event.id, eventTitle: event.title })}
              disabled={processingEventId !== null}
            >
              <Text style={styles.mapButtonText}>Map</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, processingEventId !== null && styles.secondaryButtonDisabled]}
              onPress={() => openEditModal(event)}
              disabled={processingEventId !== null}
            >
              <Text style={styles.secondaryButtonText}>Edit event</Text>
            </Pressable>
            <Pressable
              style={[styles.dangerButton, processingEventId === event.id && styles.dangerButtonDisabled]}
              onPress={() => {
                setActionError(null);
                setEventToDelete(event);
              }}
              disabled={processingEventId !== null}
            >
              <Text style={styles.dangerButtonText}>
                {processingEventId === event.id ? "Deleting..." : "Delete event"}
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Modal visible={eventToDelete !== null} transparent animationType="fade" onRequestClose={() => setEventToDelete(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete event?</Text>
            <Text style={styles.modalText}>
              {eventToDelete ? `Delete "${eventToDelete.title}" for everyone? This cannot be undone.` : ""}
            </Text>
            {actionError ? <Text style={styles.modalError}>{actionError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondaryButton}
                onPress={() => {
                  if (processingEventId === null) {
                    setEventToDelete(null);
                    setActionError(null);
                  }
                }}
                disabled={processingEventId !== null}
              >
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalDangerButton, processingEventId !== null && styles.dangerButtonDisabled]}
                onPress={() => {
                  if (eventToDelete) {
                    void handleDelete(eventToDelete.id);
                  }
                }}
                disabled={processingEventId !== null}
              >
                <Text style={styles.modalDangerButtonText}>
                  {processingEventId !== null ? "Deleting..." : "Delete"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={eventToEdit !== null} transparent animationType="fade" onRequestClose={() => setEventToEdit(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
            <Text style={styles.modalTitle}>Edit event</Text>
            <Text style={styles.modalText}>{eventToEdit ? eventToEdit.title : ""}</Text>

            <Text style={styles.fieldLabel}>Date</Text>
            {Platform.OS === "ios" ? (
              <View style={styles.iosPickerWrap}>
                <DateTimePicker
                  value={eventToEdit?.startAt ?? new Date()}
                  mode="date"
                  display="compact"
                  onChange={onEditDateChange}
                  minimumDate={new Date()}
                />
              </View>
            ) : (
              <>
                <Pressable style={styles.inputButton} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.inputButtonText}>{formattedEditDate ?? "Choose date"}</Text>
                </Pressable>
                {showDatePicker ? (
                  <DateTimePicker
                    value={eventToEdit?.startAt ?? new Date()}
                    mode="date"
                    display="default"
                    onChange={onEditDateChange}
                    minimumDate={new Date()}
                  />
                ) : null}
              </>
            )}

            <Text style={styles.fieldLabel}>Location</Text>
            <TextInput
              value={eventToEdit?.location ?? ""}
              onChangeText={(value) => {
                if (!eventToEdit) {
                  return;
                }
                setEventToEdit({ ...eventToEdit, location: value });
              }}
              placeholder="Event location"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              value={eventToEdit?.description ?? ""}
              onChangeText={(value) => {
                if (!eventToEdit) {
                  return;
                }
                setEventToEdit({ ...eventToEdit, description: value });
              }}
              placeholder="Event description"
              style={[styles.input, styles.descriptionInput]}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Visibility</Text>
            <View style={styles.visibilityRow}>
              {(["Private", "Public"] as const).map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.visibilityOption,
                    eventToEdit?.visibility === option && styles.visibilityOptionActive,
                  ]}
                  onPress={() => {
                    if (!eventToEdit) {
                      return;
                    }
                    setEventToEdit({ ...eventToEdit, visibility: option });
                  }}
                >
                  <Text
                    style={[
                      styles.visibilityOptionText,
                      eventToEdit?.visibility === option && styles.visibilityOptionTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Manage invitees</Text>
            <View style={styles.inviteRow}>
              <TextInput
                value={editInviteInput}
                onChangeText={setEditInviteInput}
                placeholder="Add a friend's username"
                style={styles.input}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <Pressable
                style={[styles.smallPrimaryButton, addingInvitee && styles.secondaryButtonDisabled]}
                onPress={() => {
                  void handleAddInvitee();
                }}
                disabled={addingInvitee || processingEventId !== null}
              >
                <Text style={styles.smallPrimaryButtonText}>{addingInvitee ? "Adding..." : "Add"}</Text>
              </Pressable>
            </View>

            {loadingInvitees ? (
              <View style={styles.inviteStateRow}>
                <ActivityIndicator size="small" />
                <Text style={styles.inviteStateText}>Loading invitees...</Text>
              </View>
            ) : eventInvitees.length === 0 ? (
              <Text style={styles.inviteEmptyText}>No one invited yet.</Text>
            ) : (
              <View style={styles.inviteeList}>
                {eventInvitees.map((invitee) => (
                  <View key={invitee.id} style={styles.inviteeCard}>
                    <View style={styles.inviteeTextWrap}>
                      <Text style={styles.inviteeName}>{invitee.name}</Text>
                      <Text style={styles.inviteeMeta}>
                        @{invitee.username} · {invitee.status}
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.removeInviteeButton, removingInviteeId === invitee.id && styles.secondaryButtonDisabled]}
                      onPress={() => {
                        void handleRemoveInvitee(invitee.id);
                      }}
                      disabled={removingInviteeId !== null || processingEventId !== null}
                    >
                      <Text style={styles.removeInviteeButtonText}>
                        {removingInviteeId === invitee.id ? "Removing..." : "Remove"}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {actionError ? <Text style={styles.modalError}>{actionError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondaryButton}
                onPress={() => {
                  if (processingEventId === null) {
                    setEventToEdit(null);
                    setShowDatePicker(false);
                    setEditInviteInput("");
                    setEventInvitees([]);
                    setActionError(null);
                  }
                }}
                disabled={processingEventId !== null}
              >
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryButton, processingEventId !== null && styles.secondaryButtonDisabled]}
                onPress={() => {
                  void handleSaveEdit();
                }}
                disabled={processingEventId !== null}
              >
                <Text style={styles.modalPrimaryButtonText}>
                  {processingEventId !== null ? "Saving..." : "Save changes"}
                </Text>
              </Pressable>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f1e8" },
  content: { padding: 20, paddingBottom: 120 },
  hero: {
    backgroundColor: "#fffaf4",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    shadowColor: "#7a5c3d",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
    marginBottom: 18,
  },
  heroEyebrow: { color: "#8a6a4a", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  heroTitle: { color: "#1f1a17", fontSize: 28, fontWeight: "800", marginBottom: 8 },
  heroSubtitle: { color: "#67594d", fontSize: 15, lineHeight: 22 },
  stateCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stateText: { color: "#6f6258", fontSize: 13 },
  errorCard: {
    backgroundColor: "#fff4f1",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#efd6cf",
    padding: 14,
    marginBottom: 12,
  },
  errorText: { color: "#a23d3d", fontSize: 13, fontWeight: "600" },
  emptyState: {
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#201c19", marginBottom: 4 },
  emptyText: { fontSize: 13, color: "#6f6258", lineHeight: 20 },
  eventCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 16,
    marginTop: 12,
  },
  eventHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  eventTitle: { fontSize: 16, fontWeight: "700", color: "#241f1c", marginBottom: 4, flex: 1, marginRight: 8 },
  eventDescription: { fontSize: 13, color: "#5f5145", marginBottom: 6, lineHeight: 19 },
  eventMeta: { fontSize: 13, color: "#6f6258" },
  visibilityBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  publicBadge: { backgroundColor: "#eef3e8", borderColor: "#d3ddc8" },
  privateBadge: { backgroundColor: "#f3eee7", borderColor: "#e2d6c6" },
  visibilityText: { fontSize: 11, fontWeight: "700", color: "#4f4339" },
  metaFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#efe4d7",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaLabel: { fontSize: 12, color: "#4e6258", fontWeight: "600" },
  actionRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#efe4d7",
    flexDirection: "row",
    gap: 10,
  },
  mapButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2f5d50",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mapButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  secondaryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#f6eee4",
    borderColor: "#eadfce",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonDisabled: { opacity: 0.6 },
  secondaryButtonText: { color: "#4f4339", fontSize: 13, fontWeight: "700" },
  dangerButton: {
    alignSelf: "flex-start",
    backgroundColor: "#fff1f1",
    borderColor: "#efc7c7",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dangerButtonDisabled: {
    opacity: 0.6,
  },
  dangerButtonText: {
    color: "#a23d3d",
    fontSize: 13,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 24, 40, 0.38)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eadfce",
    maxHeight: "88%",
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    paddingBottom: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#201c19", marginBottom: 8 },
  modalText: { fontSize: 14, color: "#5f5145", lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#4f4339", marginTop: 14, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#201c19",
    backgroundColor: "#fffaf4",
  },
  inviteRow: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 2 },
  inputButton: {
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fffaf4",
  },
  inputButtonText: { fontSize: 14, color: "#201c19" },
  iosPickerWrap: {
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fffaf4",
  },
  descriptionInput: { minHeight: 88 },
  visibilityRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  visibilityOption: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eadfce",
    backgroundColor: "#f6eee4",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  visibilityOptionActive: {
    backgroundColor: "#2f5d50",
    borderColor: "#2f5d50",
  },
  visibilityOptionText: { fontSize: 12, color: "#5f5145", fontWeight: "700" },
  visibilityOptionTextActive: { color: "#ffffff" },
  smallPrimaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2f5d50",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#2f5d50",
  },
  smallPrimaryButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  inviteStateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  inviteStateText: { color: "#6f6258", fontSize: 13 },
  inviteEmptyText: { color: "#6f6258", fontSize: 13, marginTop: 10 },
  inviteeList: { marginTop: 10, gap: 8 },
  inviteeCard: {
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: "#fff6ea",
  },
  inviteeTextWrap: { flex: 1 },
  inviteeName: { fontSize: 14, fontWeight: "700", color: "#201c19" },
  inviteeMeta: { fontSize: 12, color: "#6f6258", marginTop: 2 },
  removeInviteeButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#efc7c7",
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#fff1f1",
  },
  removeInviteeButtonText: { color: "#a23d3d", fontSize: 12, fontWeight: "700" },
  modalError: { marginTop: 10, color: "#a23d3d", fontSize: 13, fontWeight: "600" },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  modalSecondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eadfce",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#f6eee4",
  },
  modalSecondaryButtonText: { color: "#4f4339", fontWeight: "700", fontSize: 13 },
  modalPrimaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2f5d50",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#2f5d50",
  },
  modalPrimaryButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  modalDangerButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#efc7c7",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff1f1",
  },
  modalDangerButtonText: { color: "#a23d3d", fontWeight: "700", fontSize: 13 },
});
