import { View, Text, Button, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "MyInvites">;

export default function MyInvitesScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My invites</Text>
      <Text style={styles.subtitle}>Placeholder inbox for now</Text>

      <View style={{ height: 16 }} />

      <Button title="Back" onPress={() => navigation.goBack()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, opacity: 0.7 },
});
