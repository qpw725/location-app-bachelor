import { View, Text, Button, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "ChooseLocation">;

export default function ChooseLocationScreen({ navigation, route }: Props) {
  const { eventName } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose location</Text>
      <Text style={styles.subtitle}>Event: {eventName}</Text>

      <View style={styles.box}>
        <Text style={styles.boxText}>Location UI placeholder for now</Text>
      </View>

      <View style={styles.spacer} />

      <Button
        title="Continue to invites"
        onPress={() => navigation.navigate("InviteScreen", { eventName })}
      />

      <View style={styles.spacerSmall} />

      <Button title="Back" onPress={() => navigation.goBack()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, opacity: 0.7, marginBottom: 16 },
  box: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 16,
  },
  boxText: { textAlign: "center", opacity: 0.8 },
  spacer: { height: 16 },
  spacerSmall: { height: 10 },
});
