import { useEffect, useMemo, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { RootStackParamList } from "../../App";
import ProfileAvatar from "../components/ProfileAvatar";
import { fetchCurrentProfile, getProfileInitials, pickAndUploadAvatar, removeAvatar } from "../profile";
import { supabase } from "../supabase";

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
        firstName: profile.firstName,
        lastName: profile.lastName,
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
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#2f5d50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Account settings</Text>
        <Text style={styles.heroTitle}>{highlightedTitle}</Text>
        <Text style={styles.heroText}>Change your details below and save when you are ready.</Text>
      </View>

      <View style={styles.formCard}>
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

        <Text style={styles.label}>Username</Text>
        <TextInput
          value={form.username}
          onChangeText={(value) => updateField("username", value)}
          style={[styles.input, initialField === "username" && styles.highlightedInput]}
          autoCapitalize="none"
          autoFocus={initialField === "username"}
          placeholder="Username"
        />

        <Text style={styles.label}>First name</Text>
        <TextInput
          value={form.firstName}
          onChangeText={(value) => updateField("firstName", value)}
          style={[styles.input, initialField === "name" && styles.highlightedInput]}
          autoFocus={initialField === "name"}
          placeholder="First name"
        />

        <Text style={styles.label}>Last name</Text>
        <TextInput
          value={form.lastName}
          onChangeText={(value) => updateField("lastName", value)}
          style={styles.input}
          placeholder="Last name"
        />

        <Text style={styles.sectionTitle}>Login details</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={form.email}
          onChangeText={(value) => updateField("email", value)}
          style={[styles.input, initialField === "email" && styles.highlightedInput]}
          autoCapitalize="none"
          keyboardType="email-address"
          autoFocus={initialField === "email"}
          placeholder="name@example.com"
        />

        <Text style={styles.label}>New password</Text>
        <TextInput
          value={form.newPassword}
          onChangeText={(value) => updateField("newPassword", value)}
          style={[styles.input, initialField === "password" && styles.highlightedInput]}
          autoFocus={initialField === "password"}
          secureTextEntry
          placeholder="Leave blank to keep current password"
        />

        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          value={form.confirmPassword}
          onChangeText={(value) => updateField("confirmPassword", value)}
          style={styles.input}
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

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={handleSave}
          disabled={isSaving || isUploadingAvatar}
        >
          <Text style={styles.primaryButtonText}>{isSaving ? "Saving..." : "Save changes"}</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Back to profile</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f1e8",
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  loadingState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f7f1e8",
  },
  heroCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eadfce",
    shadowColor: "#7a5c3d",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  heroEyebrow: {
    color: "#8a6a4a",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  heroTitle: {
    color: "#1f1a17",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 8,
  },
  heroText: {
    color: "#67594d",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  formCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eadfce",
  },
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
    borderColor: "#2f5d50",
    backgroundColor: "#f3f7f1",
  },
  requirements: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: "#f6eee4",
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 12,
  },
  requirementText: {
    color: "#6f6258",
    fontSize: 13,
    marginVertical: 2,
  },
  requirementMet: {
    color: "#2f5d50",
    fontWeight: "700",
  },
  error: {
    color: "#c53535",
    marginTop: 12,
    fontSize: 14,
    backgroundColor: "#fff4f1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  success: {
    color: "#2f5d50",
    marginTop: 12,
    fontSize: 14,
    backgroundColor: "#eef3e8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButton: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: "#2f5d50",
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eadfce",
    backgroundColor: "#f6eee4",
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#4f4339",
    fontWeight: "800",
    fontSize: 16,
  },
  pressed: {
    opacity: 0.85,
  },
});
