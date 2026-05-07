import { useState } from "react";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getSupabaseDebugInfo, supabase, testSupabaseConnection } from "../../supabase";

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  RegisterProfile: {
    email: string;
    password: string;
  };
};

type Props = NativeStackScreenProps<AuthStackParamList, "RegisterProfile">;

export default function RegisterProfileScreen({ navigation, route }: Props) {
  const { email, password } = route.params;
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [showAndroidDobPicker, setShowAndroidDobPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  const formattedDobLabel = dateOfBirth.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const formattedDobValue = `${dateOfBirth.getFullYear()}-${String(dateOfBirth.getMonth() + 1).padStart(2, "0")}-${String(dateOfBirth.getDate()).padStart(2, "0")}`;

  function onDateOfBirthChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === "android") {
      setShowAndroidDobPicker(false);
    }

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
    setConnectionMessage(null);

    try {
      const debugInfo = getSupabaseDebugInfo();
      console.log("[Register] Supabase debug info:", debugInfo);

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

  async function handleConnectionTest() {
    setTestingConnection(true);
    setConnectionMessage(null);

    const debugInfo = getSupabaseDebugInfo();
    console.log("[Register] Supabase debug info:", debugInfo);

    const result = await testSupabaseConnection();
    console.log("[Register] Supabase connection test result:", result);

    setConnectionMessage(
      result.ok
        ? `Connection OK (HTTP ${result.status})`
        : `Connection failed (${result.status || "network error"})`
    );

    setTestingConnection(false);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      alwaysBounceVertical
      overScrollMode="always"
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Create account</Text>
        <Text style={styles.title}>Add the details for your profile</Text>
        <Text style={styles.subtitle}>Step 2 of 2</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.emailPill}>Email: {email}</Text>

        <Text style={styles.label}>Username</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          style={styles.input}
          autoCapitalize="none"
          placeholder="Username"
          placeholderTextColor="#8a7f74"
        />

        <Text style={styles.label}>First name</Text>
        <TextInput
          value={firstName}
          onChangeText={setFirstName}
          style={styles.input}
          placeholder="First name"
          placeholderTextColor="#8a7f74"
        />

        <Text style={styles.label}>Last name</Text>
        <TextInput
          value={lastName}
          onChangeText={setLastName}
          style={styles.input}
          placeholder="Last name"
          placeholderTextColor="#8a7f74"
        />

        <Text style={styles.label}>Date of birth</Text>
        {Platform.OS === "ios" ? (
          <View style={styles.iosPickerWrap}>
            <DateTimePicker
              value={dateOfBirth}
              mode="date"
              display="compact"
              onChange={onDateOfBirthChange}
              maximumDate={new Date()}
            />
          </View>
        ) : (
          <>
            <Pressable onPress={() => setShowAndroidDobPicker(true)} style={styles.pickerButton}>
              <Text style={styles.pickerButtonText}>{formattedDobLabel}</Text>
            </Pressable>
            {showAndroidDobPicker && (
              <DateTimePicker
                value={dateOfBirth}
                mode="date"
                display="default"
                onChange={onDateOfBirthChange}
                maximumDate={new Date()}
              />
            )}
          </>
        )}

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        {connectionMessage ? <Text style={styles.info}>{connectionMessage}</Text> : null}

        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={handleRegister} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? "Creating..." : "Register"}</Text>
        </Pressable>

        <Pressable
          onPress={handleConnectionTest}
          disabled={testingConnection}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryButtonText}>
            {testingConnection ? "Testing connection..." : "Test Supabase connection"}
          </Text>
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
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: "center",
  },
  heroCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    shadowColor: "#7a5c3d",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
    marginBottom: 16,
  },
  heroEyebrow: {
    color: "#8a6a4a",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: { fontSize: 30, fontWeight: "800", color: "#1f1a17" },
  subtitle: { marginTop: 8, fontSize: 15, color: "#67594d", lineHeight: 22 },
  formCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 18,
  },
  emailPill: {
    alignSelf: "flex-start",
    marginBottom: 4,
    fontSize: 13,
    color: "#5f5145",
    fontWeight: "700",
    backgroundColor: "#f6eee4",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#eadfce",
  },
  label: { marginBottom: 6, marginTop: 10, fontSize: 14, color: "#201c19", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 14,
    backgroundColor: "#fffaf4",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#201c19",
  },
  iosPickerWrap: {
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 14,
    backgroundColor: "#fffaf4",
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: 2,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 14,
    backgroundColor: "#fffaf4",
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginTop: 2,
  },
  pickerButtonText: { fontSize: 16, color: "#201c19" },
  error: {
    color: "#c53535",
    marginTop: 10,
    fontSize: 14,
    backgroundColor: "#fff4f1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  success: {
    color: "#2f7d32",
    marginTop: 10,
    fontSize: 14,
    backgroundColor: "#eef3e8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  info: {
    color: "#2f5d50",
    marginTop: 10,
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
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eadfce",
    backgroundColor: "#f6eee4",
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#4f4339", fontWeight: "700", fontSize: 16 },
  pressed: { opacity: 0.85 },
});
