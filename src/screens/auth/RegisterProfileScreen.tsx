import { useState } from "react";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../../supabase";
import { colors, commonStyles } from "../../styles/common";

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  RegisterProfile: {
    email: string;
    password: string;
  };
};

type Props = NativeStackScreenProps<AuthStackParamList, "RegisterProfile">;

export default function RegisterProfileScreen({ route }: Props) {
  const { email, password } = route.params;
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formattedDobValue = `${dateOfBirth.getFullYear()}-${String(dateOfBirth.getMonth() + 1).padStart(2, "0")}-${String(dateOfBirth.getDate()).padStart(2, "0")}`;

  function onDateOfBirthChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    selectedDate.setHours(0, 0, 0, 0);
    setDateOfBirth(selectedDate);
  }

  function mapRegisterErrorMessage(message: string) {
    const normalized = message.toLowerCase();

    if (normalized.includes("user already registered")) {
      return "That email is already registered.";
    }

    if (normalized.includes("database error saving new user")) {
      return "Could not create account. The email or username may already be in use.";
    }

    return message;
  }

  async function handleRegister() {
    if (loading) {
      return;
    }

    const trimmedUsername = username.trim();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!email || !password || !trimmedUsername || !trimmedFirstName || !trimmedLastName) {
      setErrorMessage("Please fill out all fields.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      const { data: existingUsername, error: existingUsernameError } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", trimmedUsername)
        .limit(1)
        .maybeSingle();

      if (existingUsernameError) {
        console.error("[Register] username lookup error:", existingUsernameError);
        setErrorMessage(existingUsernameError.message);
        setLoading(false);
        return;
      }

      if (existingUsername) {
        setErrorMessage("That username is already taken.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: trimmedUsername,
            first_name: trimmedFirstName,
            last_name: trimmedLastName,
            date_of_birth: formattedDobValue,
          },
        },
      });

      if (error) {
        console.error("[Register] signUp error:", error);
        const mappedMessage = mapRegisterErrorMessage(error.message);
        setErrorMessage(`${mappedMessage}${error.status ? ` (status ${error.status})` : ""}`);
      } else {
        setMessage("Account created. Check your email if confirmation is required.");
      }
    } catch (error: unknown) {
      console.error("[Register] unexpected signUp error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unexpected network error.");
    }

    setLoading(false);
  }

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.centeredContent}
      keyboardShouldPersistTaps="handled"
      alwaysBounceVertical
      overScrollMode="always"
    >
      <View style={commonStyles.heroCard}>
        <Text style={commonStyles.heroEyebrow}>Create account</Text>
        <Text style={commonStyles.heroTitle}>Add the details for your profile</Text>
        <Text style={commonStyles.heroSubtitle}>Step 2 of 2</Text>
      </View>

      <View style={commonStyles.card}>
        <Text style={styles.emailPill}>Email: {email}</Text>

        <Text style={commonStyles.label}>Username</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          style={commonStyles.input}
          autoCapitalize="none"
          placeholder="Username"
          placeholderTextColor="#8a7f74"
        />

        <Text style={commonStyles.label}>First name</Text>
        <TextInput
          value={firstName}
          onChangeText={setFirstName}
          style={commonStyles.input}
          placeholder="First name"
          placeholderTextColor="#8a7f74"
        />

        <Text style={commonStyles.label}>Last name</Text>
        <TextInput
          value={lastName}
          onChangeText={setLastName}
          style={commonStyles.input}
          placeholder="Last name"
          placeholderTextColor="#8a7f74"
        />

        <Text style={commonStyles.label}>Date of birth</Text>
        <View style={styles.iosPickerWrap}>
          <DateTimePicker
            value={dateOfBirth}
            mode="date"
            display="compact"
            onChange={onDateOfBirthChange}
            maximumDate={new Date()}
          />
        </View>

        {errorMessage ? <Text style={commonStyles.errorText}>{errorMessage}</Text> : null}
        {message ? <Text style={commonStyles.successText}>{message}</Text> : null}

        <Pressable style={({ pressed }) => [commonStyles.primaryButton, styles.buttonTop, pressed && commonStyles.pressed]} onPress={handleRegister} disabled={loading}>
          <Text style={commonStyles.primaryButtonText}>{loading ? "Creating..." : "Register"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emailPill: {
    alignSelf: "flex-start",
    marginBottom: 4,
    fontSize: 13,
    color: "#5f5145",
    fontWeight: "700",
    backgroundColor: colors.surfaceSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iosPickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: 2,
  },
  buttonTop: {
    marginTop: 18,
  },
});
