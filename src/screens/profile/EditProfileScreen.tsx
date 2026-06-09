import { useEffect, useMemo, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { RootStackParamList } from "../../../App";
import ProfileAvatar from "../../components/ProfileAvatar";
import { fetchCurrentProfile, getProfileInitials, pickAndUploadAvatar, removeAvatar } from "../../profile";
import { supabase } from "../../supabase";
import { colors, commonStyles } from "../../styles/common";

type Props = NativeStackScreenProps<RootStackParamList, "EditProfile">;

type ProfileFormState = {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  newPassword: string;
  confirmPassword: string;
};

const initialFormState: ProfileFormState = {
  username: "",
  firstName: "",
  lastName: "",
  email: "",
  avatarPath: null,
  avatarUrl: null,
  newPassword: "",
  confirmPassword: "",
};

export default function EditProfileScreen({ navigation, route }: Props) {
  const [form, setForm] = useState<ProfileFormState>(initialFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const initialField = route.params?.initialField;

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setIsLoading(true);
      setErrorMessage(null);

      const { profile, error } = await fetchCurrentProfile();

      if (!isMounted) {
        return;
      }

      if (error) {
        setErrorMessage(error);
        setIsLoading(false);
        return;
      }

      if (!profile) {
        setErrorMessage("Could not load your profile.");
        setIsLoading(false);
        return;
      }

      setCurrentUserId(profile.id);
      setForm({
        username: profile.username === "No username found" ? "" : profile.username,
        firstName: profile.firstName === "No first name found" ? "" : profile.firstName,
        lastName: profile.lastName === "No last name found" ? "" : profile.lastName,
        email: profile.email === "No email found" ? "" : profile.email,
        avatarPath: profile.avatarPath,
        avatarUrl: profile.avatarUrl,
        newPassword: "",
        confirmPassword: "",
      });
      setIsLoading(false);
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const emailLooksValid = /\S+@\S+\.\S+/.test(form.email.trim());
  const passwordLooksValid =
    form.newPassword.length === 0 ||
    (form.newPassword.length >= 8 &&
      /[A-Z]/.test(form.newPassword) &&
      /[0-9]/.test(form.newPassword) &&
      /[^A-Za-z0-9]/.test(form.newPassword));
  const passwordsMatch = form.newPassword === form.confirmPassword;

  const highlightedTitle = useMemo(() => {
    switch (initialField) {
      case "username":
        return "Update your username";
      case "name":
        return "Update your name";
      case "email":
        return "Update your email";
      case "password":
        return "Update your password";
      default:
        return "Update your profile";
    }
  }, [initialField]);

  function updateField<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const initials = getProfileInitials(`${form.firstName} ${form.lastName}`.trim() || " ", form.username);

  function promptForAvatarChange() {
    if (!currentUserId || isUploadingAvatar) {
      return;
    }

    Alert.alert("Change profile photo", "Choose how you want to update your avatar.", [
      { text: "Cancel", style: "cancel" },
      { text: "Choose photo", onPress: () => void handleAvatarChange("library") },
      { text: "Take photo", onPress: () => void handleAvatarChange("camera") },
      ...(form.avatarPath ? [{ text: "Remove photo", style: "destructive" as const, onPress: () => void handleAvatarRemove() }] : []),
    ]);
  }

  async function handleAvatarChange(source: "camera" | "library") {
    if (!currentUserId) {
      return;
    }

    setIsUploadingAvatar(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await pickAndUploadAvatar({
      source,
      userId: currentUserId,
      currentAvatarPath: form.avatarPath,
    });

    setIsUploadingAvatar(false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    if (!result.cancelled) {
      setForm((current) => ({
        ...current,
        avatarPath: result.avatarPath,
        avatarUrl: result.avatarUrl,
      }));
    }
  }

  async function handleAvatarRemove() {
    if (!currentUserId) {
      return;
    }

    setIsUploadingAvatar(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await removeAvatar({
      userId: currentUserId,
      currentAvatarPath: form.avatarPath,
    });

    setIsUploadingAvatar(false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    setForm((current) => ({
      ...current,
      avatarPath: null,
      avatarUrl: null,
    }));
  }

  async function handleSave() {
    const trimmedUsername = form.username.trim();
    const trimmedFirstName = form.firstName.trim();
    const trimmedLastName = form.lastName.trim();
    const trimmedEmail = form.email.trim();

    if (!trimmedUsername || !trimmedFirstName || !trimmedLastName || !trimmedEmail) {
      setErrorMessage("Please fill out username, first name, last name, and email.");
      setSuccessMessage(null);
      return;
    }

    if (!emailLooksValid) {
      setErrorMessage("Please enter a valid email address.");
      setSuccessMessage(null);
      return;
    }

    if (form.newPassword.length > 0 && !passwordLooksValid) {
      setErrorMessage("New password must be at least 8 characters and include a capital letter, number, and special character.");
      setSuccessMessage(null);
      return;
    }

    if (form.newPassword.length > 0 && !passwordsMatch) {
      setErrorMessage("New password and confirmation do not match.");
      setSuccessMessage(null);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload: {
      email?: string;
      password?: string;
      data: { username: string; first_name: string; last_name: string };
    } = {
      data: {
        username: trimmedUsername,
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
      },
    };

    if (trimmedEmail) {
      payload.email = trimmedEmail;
    }

    if (form.newPassword.trim()) {
      payload.password = form.newPassword;
    }

    const {
      data: { user },
      error: currentUserError,
    } = await supabase.auth.getUser();

    if (currentUserError || !user) {
      setIsSaving(false);
      setErrorMessage(currentUserError?.message ?? "Could not identify the current user.");
      return;
    }

    const { error } = await supabase.auth.updateUser(payload);

    if (error) {
      setIsSaving(false);
      setErrorMessage(error.message);
      return;
    }

    const { data: updatedProfile, error: profileError } = await supabase
      .from("profiles")
      .update({
        username: trimmedUsername,
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
      })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    setIsSaving(false);

    if (profileError) {
      setErrorMessage(profileError.message);
      return;
    }

    if (!updatedProfile) {
      setErrorMessage("Your profile row was not found in the database. Create it first or add an INSERT policy for profiles.");
      return;
    }

    setForm((current) => ({
      ...current,
      email: trimmedEmail,
      username: trimmedUsername,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      newPassword: "",
      confirmPassword: "",
    }));
    setSuccessMessage(
      payload.email || payload.password
        ? "Profile updated. If Supabase requires confirmation for email or password changes, follow the message sent to your email."
        : "Profile updated."
    );
  }

  if (isLoading) {
    return (
      <View style={commonStyles.loadingState}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={commonStyles.screen} contentContainerStyle={commonStyles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={commonStyles.heroCard}>
        <Text style={commonStyles.heroEyebrow}>Account settings</Text>
        <Text style={commonStyles.heroTitle}>{highlightedTitle}</Text>
        <Text style={commonStyles.heroSubtitle}>Change your details below and save when you are ready.</Text>
      </View>

      <View style={commonStyles.card}>
        <View style={styles.avatarSection}>
          <ProfileAvatar
            avatarUrl={form.avatarUrl}
            initials={initials}
            size={116}
            onPress={promptForAvatarChange}
            isUploading={isUploadingAvatar}
          />
          <Text style={styles.avatarHint}>Tap the photo to upload or take a new one</Text>
        </View>

        <Text style={styles.sectionTitle}>Profile information</Text>

        <Text style={commonStyles.label}>Username</Text>
        <TextInput
          value={form.username}
          onChangeText={(value) => updateField("username", value)}
          style={[commonStyles.input, initialField === "username" && styles.highlightedInput]}
          autoCapitalize="none"
          autoFocus={initialField === "username"}
          placeholder="Username"
        />

        <Text style={commonStyles.label}>First name</Text>
        <TextInput
          value={form.firstName}
          onChangeText={(value) => updateField("firstName", value)}
          style={[commonStyles.input, initialField === "name" && styles.highlightedInput]}
          autoFocus={initialField === "name"}
          placeholder="First name"
        />

        <Text style={commonStyles.label}>Last name</Text>
        <TextInput
          value={form.lastName}
          onChangeText={(value) => updateField("lastName", value)}
          style={commonStyles.input}
          placeholder="Last name"
        />

        <Text style={styles.sectionTitle}>Login details</Text>

        <Text style={commonStyles.label}>Email</Text>
        <TextInput
          value={form.email}
          onChangeText={(value) => updateField("email", value)}
          style={[commonStyles.input, initialField === "email" && styles.highlightedInput]}
          autoCapitalize="none"
          keyboardType="email-address"
          autoFocus={initialField === "email"}
          placeholder="name@example.com"
        />

        <Text style={commonStyles.label}>New password</Text>
        <TextInput
          value={form.newPassword}
          onChangeText={(value) => updateField("newPassword", value)}
          style={[commonStyles.input, initialField === "password" && styles.highlightedInput]}
          autoFocus={initialField === "password"}
          secureTextEntry
          placeholder="Leave blank to keep current password"
        />

        <Text style={commonStyles.label}>Confirm new password</Text>
        <TextInput
          value={form.confirmPassword}
          onChangeText={(value) => updateField("confirmPassword", value)}
          style={commonStyles.input}
          secureTextEntry
          placeholder="Re-enter new password"
        />

        <View style={styles.requirements}>
          <Text style={styles.requirementText}>Password change is optional.</Text>
          <Text style={[styles.requirementText, passwordLooksValid && form.newPassword.length > 0 && styles.requirementMet]}>
            - At least 8 characters, 1 capital letter, 1 number, and 1 special character
          </Text>
          <Text
            style={[
              styles.requirementText,
              passwordsMatch && form.confirmPassword.length > 0 && styles.requirementMet,
            ]}
          >
            - New password and confirmation match
          </Text>
        </View>

        {errorMessage ? <Text style={commonStyles.errorText}>{errorMessage}</Text> : null}
        {successMessage ? <Text style={commonStyles.successText}>{successMessage}</Text> : null}

        <Pressable
          style={({ pressed }) => [commonStyles.primaryButton, styles.buttonTop, pressed && commonStyles.pressed]}
          onPress={handleSave}
          disabled={isSaving || isUploadingAvatar}
        >
          <Text style={commonStyles.primaryButtonText}>{isSaving ? "Saving..." : "Save changes"}</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [commonStyles.secondaryButton, pressed && commonStyles.pressed]} onPress={() => navigation.goBack()}>
          <Text style={commonStyles.secondaryButtonText}>Back to profile</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatarSection: {
    alignItems: "center",
    marginBottom: 12,
  },
  avatarHint: {
    marginTop: 10,
    color: "#6f6258",
    fontSize: 13,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#201c19",
    marginBottom: 6,
    marginTop: 8,
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: "700",
    color: "#201c19",
  },
  input: {
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 14,
    backgroundColor: "#fffaf4",
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: "#201c19",
  },
  highlightedInput: {
    borderColor: colors.primary,
    backgroundColor: "#f3f7f1",
  },
  requirements: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  requirementText: {
    color: "#6f6258",
    fontSize: 13,
    marginVertical: 2,
  },
  requirementMet: {
    color: colors.primary,
    fontWeight: "700",
  },
  buttonTop: {
    marginTop: 18,
  },
});
