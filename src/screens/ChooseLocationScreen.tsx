import { View, Text, Button, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

type RootStackParamList = {
  CreateEvent: undefined;
  ChooseLocation: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "ChooseLocation">;

export default function ChooseLocationScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose location</Text>
      <Text style={styles.subtitle}>UI placeholder for now</Text>

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
