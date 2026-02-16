import { View, Text, StyleSheet } from "react-native";

type Props = {
  step: number;
  total: number;
  label: string;
};

export default function StepIndicator({ step, total, label }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Step {step} of {total} · {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  text: {
    fontSize: 14,
    opacity: 0.7,
  },
});
