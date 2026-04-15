import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { getSupabaseDebugInfo, supabase, testSupabaseConnection } from "../supabase";

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  RegisterProfile: {
    email: string;
    password: string;
  };
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      alwaysBounceVertical
      overScrollMode="always"
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Welcome</Text>
        <Text style={styles.title}>Login or create an account</Text>
        <Text style={styles.subtitle}>Get back to your events or sign up to start planning and joining new ones</Text>
        <Text style={styles.subtitle}></Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor="#8a7f74"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry
          placeholder="Your password"
          placeholderTextColor="#8a7f74"
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
    justifyContent: "center",
    flexGrow: 1,
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
  error: {
    color: "#c53535",
    marginTop: 10,
    fontSize: 14,
    backgroundColor: "#fff4f1",
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
