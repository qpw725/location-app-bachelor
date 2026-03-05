import { useState } from "react";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { getSupabaseDebugInfo, supabase, testSupabaseConnection } from "../supabase";

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  async function handleRegister() {
    if (!email || !password || !username || !firstName || !lastName) {
      setErrorMessage("Please fill out all fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setMessage(null);
    setConnectionMessage(null);

    try {
      const debugInfo = getSupabaseDebugInfo();
      console.log("[Register] Supabase debug info:", debugInfo);

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: username.trim(),
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            date_of_birth: formattedDobValue,
          },
        },
      });

      if (error) {
        console.error("[Register] signUp error:", error);
        setErrorMessage(`${error.message}${error.status ? ` (status ${error.status})` : ""}`);
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
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      alwaysBounceVertical
      overScrollMode="always"
    >
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.subtitle}>Register with your email and password.</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="name@example.com"
      />

      <Text style={styles.label}>Username</Text>
      <TextInput
        value={username}
        onChangeText={setUsername}
        style={styles.input}
        autoCapitalize="none"
        placeholder="Username"
      />

      <Text style={styles.label}>First name</Text>
      <TextInput
        value={firstName}
        onChangeText={setFirstName}
        style={styles.input}
        placeholder="First name"
      />

      <Text style={styles.label}>Last name</Text>
      <TextInput
        value={lastName}
        onChangeText={setLastName}
        style={styles.input}
        placeholder="Last name"
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

      <Text style={styles.label}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
        placeholder="At least 6 characters"
      />

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

      <Pressable onPress={() => navigation.navigate("Login")} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
        <Text style={styles.secondaryButtonText}>Back to login</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f6fb",
  },
  contentContainer: {
    justifyContent: "center",
    padding: 20,
    paddingBottom: 28,
    flexGrow: 1,
  },
  title: { fontSize: 30, fontWeight: "800", color: "#1a2233" },
  subtitle: { marginTop: 4, marginBottom: 24, fontSize: 15, color: "#5d6a80" },
  label: { marginBottom: 6, marginTop: 10, fontSize: 14, color: "#1a2233", fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#d9e2f3",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  iosPickerWrap: {
    borderWidth: 1,
    borderColor: "#d9e2f3",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: 2,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: "#d9e2f3",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginTop: 2,
  },
  pickerButtonText: { fontSize: 16, color: "#1a2233" },
  error: { color: "#c53535", marginTop: 10, fontSize: 14 },
  success: { color: "#2f7d32", marginTop: 10, fontSize: 14 },
  info: { color: "#1f4fa3", marginTop: 10, fontSize: 14 },
  primaryButton: {
    marginTop: 18,
    borderRadius: 12,
    backgroundColor: "#1f4fa3",
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d9e2f3",
    backgroundColor: "#fff",
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#1f4fa3", fontWeight: "700", fontSize: 16 },
  pressed: { opacity: 0.85 },
});
