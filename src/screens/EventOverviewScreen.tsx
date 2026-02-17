import { View, Text, StyleSheet, Pressable } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "EventOverview">;

export default function EventOverviewScreen({ route }: Props) {
  const { eventName } = route.params;

  // placeholder participants
  const participants = [
    { username: "ben123", status: "On my way", detail: "ETA 10 min" },
    { username: "noe123", status: "Joined", detail: "Not started" },
    { username: "anna77", status: "Invited", detail: "Pending" },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{eventName}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Event info</Text>
        <Text style={styles.cardText}>📍 Location: (placeholder)</Text>
        <Text style={styles.cardText}>🕒 Time: (placeholder)</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your status</Text>
        <Text style={styles.cardText}>Not started (placeholder)</Text>

        <View style={{ height: 12 }} />

        <Pressable style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>On my way (placeholder)</Text>
        </Pressable>

        <View style={{ height: 10 }} />

        <Pressable style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>I've arrived (placeholder)</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Participants</Text>

      {participants.map((p) => (
        <View key={p.username} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.username}>{p.username}</Text>
            <Text style={styles.status}>{p.status}</Text>
          </View>
          <Text style={styles.detail}>{p.detail}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 16 },

  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  cardText: { fontSize: 14, opacity: 0.8, marginBottom: 4 },

  primaryBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  primaryBtnText: { textAlign: "center", fontWeight: "700" },

  secondaryBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  secondaryBtnText: { textAlign: "center", fontWeight: "600", opacity: 0.8 },

  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 8, marginBottom: 10 },

  row: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  username: { fontSize: 15, fontWeight: "700" },
  status: { fontSize: 13, opacity: 0.7, marginTop: 2 },
  detail: { fontSize: 13, opacity: 0.8 },
});
