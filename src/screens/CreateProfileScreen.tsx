import { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "CreateProfile">;

export default function CreateProfileScreen({}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location] = useState("Location not set yet");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create profile</Text>
      <Text style={styles.subtitle}>Set up your basic account details</Text>

      <View style={styles.spacer} />

      <Text style={styles.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Enter your name"
        style={styles.input}
      />

      <View style={styles.spacerSmall} />

      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Enter your email"
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />

      <View style={styles.spacerSmall} />

      <Text style={styles.label}>Location</Text>
      <View style={styles.locationRow}>
        <Text style={styles.locationValue}>{location}</Text>
        <Button title="Choose location" onPress={() => {}} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 6 },
  subtitle: { fontSize: 14, opacity: 0.7 },
  label: { fontSize: 14, marginBottom: 8, opacity: 0.8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  locationRow: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  locationValue: { fontSize: 15, opacity: 0.8 },
  spacer: { height: 18 },
  spacerSmall: { height: 14 },
});
