import { View, Text, Button, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Start">;

export default function StartScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>Home</Text>
        <Text style={styles.subtitle}>Choose what you want to do</Text>

        <View style={styles.spacer} />

        <Button title="Create event and time" onPress={() => navigation.navigate("CreateEventDetails")} />

        <View style={styles.spacerSmall} />

        <Button title="Create profile" onPress={() => navigation.navigate("CreateProfile")} />

        <View style={styles.spacerSmall} />

        <Button title="Inbox" onPress={() => navigation.navigate("Inbox")} />
      </View>

      <View style={styles.bottomTab}>
        <Button title="My profile" onPress={() => navigation.navigate("MyProfile")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 14, opacity: 0.7 },
  spacer: { height: 18 },
  spacerSmall: { height: 12 },
  bottomTab: { marginTop: "auto", paddingBottom: 12 },
});


