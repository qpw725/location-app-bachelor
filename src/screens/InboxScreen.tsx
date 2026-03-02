import { View, Text, StyleSheet, ScrollView, TextInput, Pressable } from "react-native";
import { useState } from "react";

export default function InboxScreen() {
  const [searchQuery, setSearchQuery] = useState("");

  const friends = ["Bjorn Rasmussen", "Anna Jensen", "Rasmus Petersen", "Anders Kjaer"];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Add Friends</Text>

      <View style={styles.searchCard}>
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>○</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Username..."
            placeholderTextColor="#7a7a7a"
            style={styles.searchInput}
          />
          <Pressable style={styles.arrowButton}>
            <Text style={styles.arrowText}>→</Text>
          </Pressable>
        </View>
      </View>


      <Text style={styles.sectionTitle}>My Friends</Text>

      {friends.map((friend) => (
        <Pressable key={friend} style={({ pressed }) => [styles.friendCard, pressed && styles.pressed]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>●</Text>
          </View>
          <Text style={styles.friendName}>{friend}</Text>
          <Text style={styles.friendArrow}>→</Text>
        </Pressable>
      ))}

      <View style={styles.bottomPlaceholder} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eeeeee" },
  content: { padding: 14, paddingBottom: 24 },
  sectionTitle: {
    fontSize: 34,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 12,
    color: "#0e0e0e",
  },
  searchCard: {
    backgroundColor: "#f6f6f6",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d2d2d2",
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchRow: { flexDirection: "row", alignItems: "center" },
  searchIcon: { fontSize: 22, color: "#5f5f5f", marginRight: 8 },
  searchInput: { flex: 1, fontSize: 18, color: "#111111", paddingVertical: 8 },
  arrowButton: { paddingHorizontal: 6, paddingVertical: 2 },
  arrowText: { fontSize: 28, color: "#111111" },
  searchHelperText: {
    marginTop: 10,
    marginBottom: 18,
    fontSize: 13,
    color: "#6a6a6a",
  },
  friendCard: {
    backgroundColor: "#f6f6f6",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d2d2d2",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pressed: { opacity: 0.86 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#d8d8d8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: { color: "#f4f4f4", fontSize: 16 },
  friendName: { flex: 1, fontSize: 24, fontWeight: "600", color: "#101010" },
  friendArrow: { fontSize: 30, color: "#111111", marginLeft: 8 },
  bottomPlaceholder: {
    marginTop: 18,
    height: 80,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dcdcdc",
    backgroundColor: "#f3f3f3",
  },
});
