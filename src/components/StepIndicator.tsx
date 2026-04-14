import { View, Text, StyleSheet } from "react-native";

type Props = {
  step: number;
  total: number;
  label: string;
};

export default function StepIndicator({ step, total, label }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Step {step} of {total}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    borderRadius: 999,
    backgroundColor: "#f6eee4",
    borderWidth: 1,
    borderColor: "#eadfce",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeText: {
    fontSize: 12,
    color: "#5f5145",
    fontWeight: "700",
  },
  label: {
    fontSize: 14,
    color: "#8a6a4a",
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
