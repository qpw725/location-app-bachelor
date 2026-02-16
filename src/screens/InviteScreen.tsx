import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import StepIndicator from "../components/StepIndicator";


type Props = NativeStackScreenProps<RootStackParamList, "InviteScreen">;

export default function InviteScreen({ navigation, route }: Props) {
  const { eventName } = route.params;
  const [email, setEmail] = useState("");

  return (
    <View style={styles.container}>
      <StepIndicator step={3} total={3} label="Invite people" />
      <Text style={styles.title}>Invite friends</Text>
      <Text style={styles.subtitle}>Event: {eventName}</Text>

      <View style={styles.spacerSmall} />

      <Text style={styles.label}>Identifier (placeholder)</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="e.g. ben123"
        style={styles.input}
      />

      <View style={styles.spacer} />

      <Button
        title="Send invite (placeholder)"
        onPress={() => navigation.navigate("CreateEvent")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 6 },
  subtitle: { fontSize: 14, opacity: 0.7, marginBottom: 12 },
  label: { fontSize: 14, marginBottom: 8, opacity: 0.8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  spacer: { height: 16 },
  spacerSmall: { height: 8 },
});
