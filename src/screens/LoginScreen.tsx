import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { getSupabaseDebugInfo, supabase, testSupabaseConnection } from "../supabase";

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  async function handleLogin() {
    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setConnectionMessage(null);

    try {
      const debugInfo = getSupabaseDebugInfo();
      console.log("[Login] Supabase debug info:", debugInfo);

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error("[Login] signIn error:", error);
        setErrorMessage(`${error.message}${error.status ? ` (status ${error.status})` : ""}`);
      }
    } catch (error: unknown) {
      console.error("[Login] unexpected signIn error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unexpected network error.");
    }

    setLoading(false);
  }

  async function handleConnectionTest() {
    setTestingConnection(true);
    setConnectionMessage(null);

    const debugInfo = getSupabaseDebugInfo();
    console.log("[Login] Supabase debug info:", debugInfo);

    const result = await testSupabaseConnection();
    console.log("[Login] Supabase connection test result:", result);

    setConnectionMessage(
      result.ok
        ? `Connection OK (HTTP ${result.status})`
        : `Connection failed (${result.status || "network error"})`
    );

    setTestingConnection(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Log in to continue.</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
        placeholder="Your password"
      />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {connectionMessage ? <Text style={styles.info}>{connectionMessage}</Text> : null}

      <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={handleLogin} disabled={loading}>
        <Text style={styles.primaryButtonText}>{loading ? "Logging in..." : "Login"}</Text>
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

      <Pressable onPress={() => navigation.navigate("Register")} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
        <Text style={styles.secondaryButtonText}>Create account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f6fb",
    justifyContent: "center",
    padding: 20,
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
  error: { color: "#c53535", marginTop: 10, fontSize: 14 },
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
