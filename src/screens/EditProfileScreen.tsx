import { useEffect, useMemo, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { RootStackParamList } from "../../App";
import { supabase } from "../supabase";

type Props = NativeStackScreenProps<RootStackParamList, "EditProfile">;

type ProfileFormState = {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  newPassword: string;
  confirmPassword: string;
};

const initialFormState: ProfileFormState = {
  username: "",
  firstName: "",
  lastName: "",
  email: "",
  newPassword: "",
  confirmPassword: "",
};

export default function EditProfileScreen({ navigation, route }: Props) {
  const [form, setForm] = useState<ProfileFormState>(initialFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const initialField = route.params?.initialField;

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setIsLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      const user = data.user;
      const metadata = user?.user_metadata as
        | { username?: string; first_name?: string; last_name?: string }
        | undefined;

      setForm({
        username: metadata?.username?.trim() ?? "",
        firstName: metadata?.first_name?.trim() ?? "",
        lastName: metadata?.last_name?.trim() ?? "",
        email: user?.email?.trim() ?? "",
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
        <ActivityIndicator size="large" color="#1f4fa3" />
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

        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={handleSave} disabled={isSaving}>
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
    backgroundColor: "#eef3fb",
  },
  content: {
    padding: 20,
    paddingBottom: 28,
  },
  loadingState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eef3fb",
  },
  heroCard: {
    backgroundColor: "#1f4fa3",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  heroEyebrow: {
    color: "#c7d7f8",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 8,
  },
  heroText: {
    color: "#e8eefb",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#d7e1f2",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1a2233",
    marginBottom: 6,
    marginTop: 8,
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: "700",
    color: "#1a2233",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d9e2f3",
    borderRadius: 14,
    backgroundColor: "#f9fbff",
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: "#1a2233",
  },
  highlightedInput: {
    borderColor: "#1f4fa3",
    backgroundColor: "#f1f6ff",
  },
  requirements: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: "#f6f9ff",
    borderWidth: 1,
    borderColor: "#d9e2f3",
    padding: 12,
  },
  requirementText: {
    color: "#5d6a80",
    fontSize: 13,
    marginVertical: 2,
  },
  requirementMet: {
    color: "#2f7d32",
    fontWeight: "700",
  },
  error: {
    color: "#c53535",
    marginTop: 12,
    fontSize: 14,
  },
  success: {
    color: "#2f7d32",
    marginTop: 12,
    fontSize: 14,
  },
  primaryButton: {
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: "#1f4fa3",
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d9e2f3",
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#1f4fa3",
    fontWeight: "800",
    fontSize: 16,
  },
  pressed: {
    opacity: 0.85,
  },
});
