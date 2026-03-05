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
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      alwaysBounceVertical
      overScrollMode="always"
    >
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.subtitle}>Step 1 of 2: account credentials.</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="name@example.com"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
        placeholder="At least 8 characters"
      />

      <Text style={styles.label}>Re-enter password</Text>
      <TextInput
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        style={styles.input}
        secureTextEntry
        placeholder="Re-enter password"
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
  requirements: {
    marginTop: 10,
    backgroundColor: "#fff",
    borderColor: "#d9e2f3",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  requirementItem: { color: "#5d6a80", fontSize: 13, marginVertical: 2 },
  requirementMet: { color: "#2f7d32", fontWeight: "600" },
  error: { color: "#c53535", marginTop: 10, fontSize: 14 },
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
