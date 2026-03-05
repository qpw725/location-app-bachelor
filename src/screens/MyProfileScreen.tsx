import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../../App";
import { supabase } from "../supabase";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "MyProfile">,
  NativeStackScreenProps<RootStackParamList>
>;

export default function MyProfileScreen({ navigation }: Props) {
  const [userEmail, setUserEmail] = useState("No email found");
  const [displayName, setDisplayName] = useState("No name found");
  const [displayUsername, setDisplayUsername] = useState("No username found");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      const metadata = user?.user_metadata as
        | { first_name?: string; last_name?: string; username?: string }
        | undefined;

      const firstName = metadata?.first_name?.trim() ?? "";
      const lastName = metadata?.last_name?.trim() ?? "";
      const fullName = `${firstName} ${lastName}`.trim();

      setUserEmail(user?.email ?? "No email found");
      setDisplayName(fullName || "No name found");
      setDisplayUsername(metadata?.username?.trim() || "No username found");
    });
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatarCircle}>
          <View style={styles.avatarHead} />
          <View style={styles.avatarBody} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Information</Text>

        <View style={styles.card}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.username}>{displayUsername}</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>@</Text>
            <Text style={styles.infoText}>{userEmail}</Text>
            <Text style={styles.rowArrow}>{">"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>o</Text>
            <Text style={styles.infoText}>Copenhagen, Denmark</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>#</Text>
            <Text style={styles.infoText}>Member since 2026</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <Pressable
          style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
          onPress={() => navigation.navigate("NotificationSettings")}
        >
          <Text style={styles.settingsText}>Notifications</Text>
          <Text style={styles.rowArrow}>{">"}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.settingsRow, styles.settingsRowSpacing, pressed && styles.pressed]}
          onPress={handleSignOut}
        >
          <Text style={styles.settingsText}>Log off</Text>
          <Text style={styles.rowArrow}>{">"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eeeeee" },
  content: { padding: 14, paddingBottom: 24 },
  avatarWrap: { alignItems: "center", marginTop: 6, marginBottom: 16 },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#cbcbcd",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHead: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#eaeaea",
    marginBottom: 6,
  },
  avatarBody: {
    width: 62,
    height: 38,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    backgroundColor: "#eaeaea",
  },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 24, fontWeight: "700", marginBottom: 8, color: "#111111" },
  card: {
    borderWidth: 1,
    borderColor: "#d2d2d2",
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#f6f6f6",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  name: { fontSize: 32, fontWeight: "500", color: "#111111", marginBottom: 2 },
  username: { fontSize: 29, color: "#5f5f5f", marginBottom: 8 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  infoIcon: { fontSize: 22, color: "#111111", width: 28 },
  infoText: { fontSize: 24, color: "#111111", flex: 1, marginLeft: 6 },
  rowArrow: { fontSize: 28, color: "#111111", marginLeft: 8 },
  settingsRow: {
    borderWidth: 1,
    borderColor: "#d2d2d2",
    borderRadius: 16,
    backgroundColor: "#f6f6f6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  settingsRowSpacing: {
    marginTop: 10,
  },
  settingsText: {
    fontSize: 22,
    color: "#111111",
    flex: 1,
  },
  pressed: { opacity: 0.86 },
});
