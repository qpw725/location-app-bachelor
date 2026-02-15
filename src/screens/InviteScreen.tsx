import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

type RootStackParamList = {
  CreateEvent: undefined;
  ChooseLocation: undefined;
  InviteScreen: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "InviteScreen">;

export default function InviteScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Invite friends</Text>

        <Text style={styles.label}>Email address</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="e.g. ben@example.com"
          style={styles.input}
        />

        <View style={styles.spacer} />

        <Button title="Send invite"  
        onPress={() => navigation.navigate("CreateEvent")} />
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
