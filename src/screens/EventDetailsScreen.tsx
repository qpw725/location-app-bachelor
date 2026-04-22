import { useCallback, useEffect, useState } from "react";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as Calendar from "expo-calendar";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import EventAttendeeSection from "../components/EventAttendeeSection";
import {
  addHostedEventInvite,
  deleteHostedEvent,
  fetchEventBuckets,
  fetchHostedEventInvitees,
  leaveEvent,
  removeHostedEventInvite,
  type EventItem,
  type HostedEventInvitee,
  updateHostedEvent,
} from "../data/eventStore";

type Props = NativeStackScreenProps<RootStackParamList, "EventDetails">;

type EditDraft = {
  eventId: string;
  title: string;
  description: string;
  location: string;
  visibility: "Private" | "Public";
  startAt: Date;
  endAt: Date;
};

export default function EventDetailsScreen({ navigation, route }: Props) {
  const { eventId, eventTitle, mode } = route.params;
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingEventId, setProcessingEventId] = useState<string | null>(null);
  const [eventToLeave, setEventToLeave] = useState<EventItem | null>(null);
  const [eventToDelete, setEventToDelete] = useState<EventItem | null>(null);
  const [eventToEdit, setEventToEdit] = useState<EditDraft | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editInviteInput, setEditInviteInput] = useState("");
  const [eventInvitees, setEventInvitees] = useState<HostedEventInvitee[]>([]);
  const [loadingInvitees, setLoadingInvitees] = useState(false);
  const [addingInvitee, setAddingInvitee] = useState(false);
  const [removingInviteeId, setRemovingInviteeId] = useState<string | null>(null);
  const [addingToCalendar, setAddingToCalendar] = useState(false);

  const loadEvent = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await fetchEventBuckets();

    if (fetchError || !data) {
      setError(fetchError ?? "Could not load event.");
      setLoading(false);
      return;
    }

    const sourceEvents =
      mode === "attending" ? data.attendingEvents : mode === "hosting" ? data.hostingEvents : data.pastEvents;
    const nextEvent = sourceEvents.find((item) => item.id === eventId) ?? null;

    if (!nextEvent) {
      setError("Event not found.");
    }

    setEvent(nextEvent);
    setLoading(false);
  }, [eventId, mode]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvent();
    setRefreshing(false);
  }, [loadEvent]);

  const loadEventInvitees = useCallback(async (targetEventId: string) => {
    setLoadingInvitees(true);
    const { data, error: inviteesError } = await fetchHostedEventInvitees(targetEventId);
    if (inviteesError) {
      setActionError(inviteesError);
      setLoadingInvitees(false);
      return;
    }
    setEventInvitees(data ?? []);
    setLoadingInvitees(false);
  }, []);

  function openEditModal(targetEvent: EventItem) {
    if (!targetEvent.startAt || !targetEvent.endAt) {
      return;
    }

    setActionError(null);
    setEditInviteInput("");
    setEventInvitees([]);
    setEventToEdit({
      eventId: targetEvent.id,
      title: targetEvent.title,
      description: targetEvent.description === "No description provided" ? "" : targetEvent.description,
      location: targetEvent.place === "Location not set" ? "" : targetEvent.place,
      visibility: targetEvent.visibility,
      startAt: new Date(targetEvent.startAt),
      endAt: new Date(targetEvent.endAt),
    });
    void loadEventInvitees(targetEvent.id);
  }

  const handleLeave = useCallback(async () => {
    if (!eventToLeave) {
      return;
    }

    setActionError(null);
    setProcessingEventId(eventToLeave.id);
    const { error: leaveError } = await leaveEvent(eventToLeave.id);
    if (leaveError) {
      setActionError(leaveError);
      setProcessingEventId(null);
      return;
    }
    setEventToLeave(null);
    setProcessingEventId(null);
    navigation.goBack();
  }, [eventToLeave, navigation]);

  const handleDelete = useCallback(async () => {
    if (!eventToDelete) {
      return;
    }

    setActionError(null);
    setProcessingEventId(eventToDelete.id);
    const { error: deleteError } = await deleteHostedEvent(eventToDelete.id);
    if (deleteError) {
      setActionError(deleteError);
      setProcessingEventId(null);
      return;
    }
    setEventToDelete(null);
    setProcessingEventId(null);
    navigation.goBack();
  }, [eventToDelete, navigation]);

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

    setEventToEdit(null);
    setProcessingEventId(null);
    await loadEvent();
  }, [eventToEdit, loadEvent]);

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

  const handleAddToCalendar = useCallback(async () => {
    if (!event) {
      return;
    }

    if (!event.startAt) {
      setActionError("This event does not have a start time.");
      return;
    }

    setActionError(null);
    setAddingToCalendar(true);

    try {
      const isAvailable = await Calendar.isAvailableAsync();
      if (!isAvailable) {
        setActionError("Calendar is not available on this device.");
        return;
      }

      const endDate = event.endAt && event.endAt.getTime() > event.startAt.getTime()
        ? event.endAt
        : new Date(event.startAt.getTime() + 60 * 60 * 1000);

      await Calendar.createEventInCalendarAsync({
        title: event.title,
        startDate: event.startAt,
        endDate,
        location: event.place === "Location not set" ? undefined : event.place,
        notes: event.description === "No description provided" ? undefined : event.description,
      });
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "Could not add this event to your calendar.");
    } finally {
      setAddingToCalendar(false);
    }
  }, [event]);

  function onEditDateChange(_event: DateTimePickerEvent, selectedDate?: Date) {
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="small" />
          <Text style={styles.stateText}>Loading event...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {event ? (
        <View style={styles.eventCard}>
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
              style={[styles.calendarButton, addingToCalendar && styles.secondaryButtonDisabled]}
              onPress={() => void handleAddToCalendar()}
              disabled={addingToCalendar}
            >
              <Text style={styles.calendarButtonText}>
                {addingToCalendar ? "Opening..." : "Add to calendar"}
              </Text>
            </Pressable>

            {mode !== "past" ? (
              <>
              <Pressable
                style={styles.mapButton}
                onPress={() => navigation.navigate("EventMap", { eventId: event.id, eventTitle: event.title })}
                disabled={processingEventId !== null}
              >
                <Text style={styles.mapButtonText}>Map</Text>
              </Pressable>

              {mode === "hosting" ? (
                <>
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
                </>
              ) : (
                <Pressable
                  style={[styles.secondaryButton, processingEventId === event.id && styles.secondaryButtonDisabled]}
                  onPress={() => {
                    setActionError(null);
                    setEventToLeave(event);
                  }}
                  disabled={processingEventId !== null}
                >
                  <Text style={styles.secondaryButtonText}>
                    {processingEventId === event.id ? "Leaving..." : "Leave event"}
                  </Text>
                </Pressable>
              )}
              </>
            ) : null}
          </View>

          {actionError ? <Text style={styles.inlineError}>{actionError}</Text> : null}
        </View>
      ) : null}

      <Modal visible={eventToLeave !== null} transparent animationType="fade" onRequestClose={() => setEventToLeave(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Leave event?</Text>
            <Text style={styles.modalText}>{eventToLeave ? `Remove yourself from "${eventToLeave.title}"?` : ""}</Text>
            {actionError ? <Text style={styles.modalError}>{actionError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondaryButton}
                onPress={() => {
                  if (processingEventId === null) {
                    setEventToLeave(null);
                    setActionError(null);
                  }
                }}
                disabled={processingEventId !== null}
              >
                <Text style={styles.modalSecondaryButtonText}>Stay</Text>
              </Pressable>
              <Pressable
                style={[styles.modalDangerButton, processingEventId !== null && styles.secondaryButtonDisabled]}
                onPress={() => void handleLeave()}
                disabled={processingEventId !== null}
              >
                <Text style={styles.modalDangerButtonText}>
                  {processingEventId !== null ? "Leaving..." : "Leave"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
                onPress={() => void handleDelete()}
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
              <Text style={styles.modalText}>{eventToEdit ? eventToEdit.title : eventTitle}</Text>

              <Text style={styles.fieldLabel}>Date</Text>
              <View style={styles.iosPickerWrap}>
                <DateTimePicker
                  value={eventToEdit?.startAt ?? new Date()}
                  mode="date"
                  display="compact"
                  onChange={onEditDateChange}
                  minimumDate={new Date()}
                />
              </View>

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
                  onPress={() => void handleAddInvitee()}
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
                          @{invitee.username} - {invitee.status}
                        </Text>
                      </View>
                      <Pressable
                        style={[
                          styles.removeInviteeButton,
                          removingInviteeId === invitee.id && styles.secondaryButtonDisabled,
                        ]}
                        onPress={() => void handleRemoveInvitee(invitee.id)}
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
                  onPress={() => void handleSaveEdit()}
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
  eventCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 16,
  },
  eventHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  eventTitle: { fontSize: 20, fontWeight: "800", color: "#241f1c", marginBottom: 4, flex: 1, marginRight: 8 },
  eventDescription: { fontSize: 14, color: "#5f5145", marginBottom: 8, lineHeight: 20 },
  eventMeta: { fontSize: 14, color: "#6f6258", lineHeight: 20 },
  visibilityBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  publicBadge: { backgroundColor: "#eef3e8", borderColor: "#d3ddc8" },
  privateBadge: { backgroundColor: "#f3eee7", borderColor: "#e2d6c6" },
  visibilityText: { fontSize: 11, fontWeight: "700", color: "#4f4339" },
  metaFooter: {
    marginTop: 10,
    paddingTop: 10,
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
    flexWrap: "wrap",
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
  calendarButton: {
    alignSelf: "flex-start",
    backgroundColor: "#eef3e8",
    borderColor: "#d3ddc8",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  calendarButtonText: { color: "#2f5d50", fontSize: 13, fontWeight: "700" },
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
  dangerButtonDisabled: { opacity: 0.6 },
  dangerButtonText: { color: "#a23d3d", fontSize: 13, fontWeight: "700" },
  inlineError: { marginTop: 10, color: "#a23d3d", fontSize: 13, fontWeight: "600" },
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
  modalScroll: { flexGrow: 0 },
  modalScrollContent: { paddingBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#201c19", marginBottom: 8 },
  modalText: { fontSize: 14, color: "#5f5145", lineHeight: 20 },
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
  modalDangerButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#efc7c7",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff1f1",
  },
  modalDangerButtonText: { color: "#a23d3d", fontWeight: "700", fontSize: 13 },
  modalPrimaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2f5d50",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#2f5d50",
  },
  modalPrimaryButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
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
  inviteRow: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 2 },
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
});
