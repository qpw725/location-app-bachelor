import { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, commonStyles } from "../../styles/common";

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
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.centeredContent}
      keyboardShouldPersistTaps="handled"
      alwaysBounceVertical
      overScrollMode="always"
    >
      <View style={commonStyles.heroCard}>
        <Text style={commonStyles.heroEyebrow}>Create account</Text>
        <Text style={commonStyles.heroTitle}>Set up your login details</Text>
        <Text style={commonStyles.heroSubtitle}>Step 1 of 2</Text>
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={commonStyles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="name@example.com"
          placeholderTextColor="#8a7f74"
        />

        <Text style={commonStyles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          style={commonStyles.input}
          secureTextEntry
          placeholder="At least 8 characters"
          placeholderTextColor="#8a7f74"
        />

        <Text style={commonStyles.label}>Re-enter password</Text>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={commonStyles.input}
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

        {errorMessage ? <Text style={commonStyles.errorText}>{errorMessage}</Text> : null}

        <Pressable style={({ pressed }) => [commonStyles.primaryButton, pressed && commonStyles.pressed]} onPress={handleContinue}>
          <Text style={commonStyles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  requirements: {
    marginTop: 10,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  requirementItem: { color: "#6f6258", fontSize: 13, marginVertical: 2 },
  requirementMet: { color: "#2f7d32", fontWeight: "600" },
});
