import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../../App";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Start">,
  NativeStackScreenProps<RootStackParamList>
>;

export default function StartScreen({ navigation }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>HOME</Text>
        <Text style={styles.title}>Hi, Benjamin</Text>
        <Text style={styles.subtitle}>Plan your next meetup fast.</Text>
        <View style={styles.heroChip}>
          <Text style={styles.heroChipText}>No upcoming events yet</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Get started</Text>
        <Pressable
          style={({ pressed }) => [styles.primaryCard, pressed && styles.pressed]}
          onPress={() => navigation.navigate("CreateEventDetails")}
        >
          <Text style={styles.primaryCardTitle}>Create event</Text>
          <Text style={styles.primaryCardText}>Set event details, date, and location.</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryCard, pressed && styles.pressed]}
          onPress={() => navigation.navigate("CreateProfile")}
        >
          <Text style={styles.secondaryCardTitle}>Create profile</Text>
          <Text style={styles.secondaryCardText}>Add your details so people can recognize you.</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Pending invites</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Hosting</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>What's new?</Text>
          <Pressable onPress={() => navigation.navigate("Inbox")}>
            <Text style={styles.sectionAction}>View inbox</Text>
          </Pressable>
        </View>

        <View style={styles.activityCard}>
          <Text style={styles.activityTitle}>No recent activity yet</Text>
          <Text style={styles.activityText}>New events and invites will appear here.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6fb" },
  content: { padding: 20, paddingBottom: 28 },
  hero: {
    backgroundColor: "#10264a",
    borderRadius: 20,
    padding: 18,
  },
  eyebrow: {
    color: "#9fb7db",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: { color: "#ffffff", fontSize: 30, fontWeight: "800", marginBottom: 4 },
  subtitle: { color: "#d7e3f6", fontSize: 14 },
  heroChip: {
    marginTop: 14,
    alignSelf: "flex-start",
    backgroundColor: "#1d3c70",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroChipText: { color: "#d7e3f6", fontSize: 12, fontWeight: "600" },
  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1a2233", marginBottom: 10 },
  sectionAction: { fontSize: 14, fontWeight: "700", color: "#1f4fa3" },
  primaryCard: {
    backgroundColor: "#1f4fa3",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  primaryCardTitle: { color: "#ffffff", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  primaryCardText: { color: "#d8e5fb", fontSize: 14, lineHeight: 20 },
  secondaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#d9e2f3",
  },
  secondaryCardTitle: { color: "#1a2233", fontSize: 17, fontWeight: "700", marginBottom: 4 },
  secondaryCardText: { color: "#4f5f78", fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.85 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#e4eaf5",
  },
  statValue: { fontSize: 20, fontWeight: "800", color: "#1a2233" },
  statLabel: { marginTop: 3, fontSize: 12, color: "#5d6a80" },
  activityCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
  },
  activityTitle: { color: "#1a2233", fontSize: 15, fontWeight: "700", marginBottom: 4 },
  activityText: { color: "#5d6a80", fontSize: 14 },
});
