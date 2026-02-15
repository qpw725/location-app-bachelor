import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

type RootStackParamList = {
  CreateEvent: undefined;
  ChooseLocation: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "CreateEvent">;

export default function CreateEventScreen({ navigation }: Props) {
  const [eventName, setEventName] = useState("");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create event</Text>

      <Text style={styles.label}>Event name</Text>
      <TextInput
        value={eventName}
        onChangeText={setEventName}
        placeholder="e.g. Pre-drinks at Ben’s"
        style={styles.input}
      />

      <View style={styles.spacer} />

      <Button
        title="Choose location"
        onPress={() => navigation.navigate("ChooseLocation")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 20 },
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
});
