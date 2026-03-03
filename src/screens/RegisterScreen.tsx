import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "../supabase";

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleRegister() {
    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setMessage(null);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setMessage("Account created. Check your email if confirmation is required.");
    }

    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.subtitle}>Register with your email and password.</Text>

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
        placeholder="At least 6 characters"
      />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={handleRegister} disabled={loading}>
        <Text style={styles.primaryButtonText}>{loading ? "Creating..." : "Register"}</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate("Login")} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
        <Text style={styles.secondaryButtonText}>Back to login</Text>
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
  success: { color: "#2f7d32", marginTop: 10, fontSize: 14 },
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
