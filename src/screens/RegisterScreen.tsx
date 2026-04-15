import { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  RegisterProfile: {
    email: string;
    password: string;
  };
};

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password === confirmPassword;

  function handleContinue() {
    const trimmedEmail = email.trim();
    const emailLooksValid = /\S+@\S+\.\S+/.test(trimmedEmail);

    if (!trimmedEmail || !password || !confirmPassword) {
      setErrorMessage("Please fill out email, password, and re-enter password.");
      return;
    }

    if (!emailLooksValid) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!hasMinLength || !hasUppercase || !hasNumber || !hasSpecialCharacter) {
      setErrorMessage("Password does not meet the required rules.");
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setErrorMessage(null);
    navigation.navigate("RegisterProfile", { email: trimmedEmail, password });
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
        <Text style={styles.title}>Set up your login details</Text>
        <Text style={styles.subtitle}>Step 1 of 2</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="name@example.com"
          placeholderTextColor="#8a7f74"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry
          placeholder="At least 8 characters"
          placeholderTextColor="#8a7f74"
        />

        <Text style={styles.label}>Re-enter password</Text>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={styles.input}
          secureTextEntry
          placeholder="Re-enter password"
          placeholderTextColor="#8a7f74"
        />

        <View style={styles.requirements}>
          <Text style={[styles.requirementItem, hasMinLength && styles.requirementMet]}>- At least 8 characters</Text>
          <Text style={[styles.requirementItem, hasUppercase && styles.requirementMet]}>- At least 1 capital letter</Text>
          <Text style={[styles.requirementItem, hasNumber && styles.requirementMet]}>- At least 1 number</Text>
          <Text style={[styles.requirementItem, hasSpecialCharacter && styles.requirementMet]}>- At least 1 special character</Text>
          <Text style={[styles.requirementItem, passwordsMatch && confirmPassword.length > 0 && styles.requirementMet]}>- Passwords match</Text>
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={handleContinue}>
          <Text style={styles.primaryButtonText}>Continue</Text>
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
  requirements: {
    marginTop: 10,
    backgroundColor: "#fff6ea",
    borderColor: "#eadfce",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  requirementItem: { color: "#6f6258", fontSize: 13, marginVertical: 2 },
  requirementMet: { color: "#2f7d32", fontWeight: "600" },
  error: {
    color: "#c53535",
    marginTop: 10,
    fontSize: 14,
    backgroundColor: "#fff4f1",
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
  pressed: { opacity: 0.85 },
});
