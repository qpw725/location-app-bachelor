import { View, Text, StyleSheet } from "react-native";

export default function NotificationSettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notification settings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eeeeee",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111111",
  },
});
