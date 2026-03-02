import { View, Text, StyleSheet } from "react-native";

export default function MyProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My profile</Text>
      <Text style={styles.subtitle}>Account details (placeholder)</Text>

      <View style={styles.spacer} />

      <View style={styles.card}>
        <Text style={styles.label}>Username</Text>
        <Text style={styles.value}>benjamin_123</Text>

        <View style={styles.spacerSmall} />

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>benjamin@example.com</Text>

        <View style={styles.spacerSmall} />

        <Text style={styles.label}>Location</Text>
        <Text style={styles.value}>Copenhagen, Denmark</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 6 },
  subtitle: { fontSize: 14, opacity: 0.7 },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#fff",
  },
  label: { fontSize: 13, opacity: 0.7, marginBottom: 2 },
  value: { fontSize: 18, fontWeight: "600" },
  spacer: { height: 18 },
  spacerSmall: { height: 14 },
});
