import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "../../supabase";
import { commonStyles } from "../../styles/common";

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogin() {
    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
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

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.centeredContent}
      keyboardShouldPersistTaps="handled"
      alwaysBounceVertical
      overScrollMode="always"
    >
      <View style={commonStyles.heroCard}>
        <Text style={commonStyles.heroEyebrow}>Welcome</Text>
        <Text style={commonStyles.heroTitle}>Login or create an account</Text>
        <Text style={commonStyles.heroSubtitle}>Get back to your events or sign up to start planning and joining new ones</Text>
        <Text style={commonStyles.heroSubtitle}></Text>
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={commonStyles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor="#8a7f74"
        />

        <Text style={commonStyles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          style={commonStyles.input}
          secureTextEntry
          placeholder="Your password"
          placeholderTextColor="#8a7f74"
        />

        {errorMessage ? <Text style={commonStyles.errorText}>{errorMessage}</Text> : null}

        <Pressable style={({ pressed }) => [commonStyles.primaryButton, styles.buttonTop, pressed && commonStyles.pressed]} onPress={handleLogin} disabled={loading}>
          <Text style={commonStyles.primaryButtonText}>{loading ? "Logging in..." : "Login"}</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate("Register")} style={({ pressed }) => [commonStyles.secondaryButton, pressed && commonStyles.pressed]}>
          <Text style={commonStyles.secondaryButtonText}>Create account</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  buttonTop: {
    marginTop: 18,
  },
});
