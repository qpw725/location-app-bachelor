import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../../App";
import { supabase } from "../supabase";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "MyProfile">,
  NativeStackScreenProps<RootStackParamList>
>;

type ProfileDetails = {
  email: string;
  fullName: string;
  username: string;
  memberSince: string;
};

const defaultProfile: ProfileDetails = {
  email: "No email found",
  fullName: "No name found",
  username: "No username found",
  memberSince: "Unknown",
};

export default function MyProfileScreen({ navigation }: Props) {
  const [profile, setProfile] = useState<ProfileDetails>(defaultProfile);

  const loadProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    const metadata = user?.user_metadata as
      | { first_name?: string; last_name?: string; username?: string }
      | undefined;

    const firstName = metadata?.first_name?.trim() ?? "";
    const lastName = metadata?.last_name?.trim() ?? "";
    const fullName = `${firstName} ${lastName}`.trim();
    const createdAt = user?.created_at ? new Date(user.created_at) : null;
    const createdAtLabel =
      createdAt && !Number.isNaN(createdAt.getTime())
        ? createdAt.toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" })
        : "Unknown";

    setProfile({
      email: user?.email ?? "No email found",
      fullName: fullName || "No name found",
      username: metadata?.username?.trim() || "No username found",
      memberSince: createdAtLabel,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const initials = profile.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  function openEditProfile(initialField: "username" | "name" | "email" | "password") {
    navigation.navigate("EditProfile", { initialField });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || "?"}</Text>
        </View>

        <Text style={styles.name}>{profile.fullName}</Text>
        <Text style={styles.username}>@{profile.username.replace(/^@/, "")}</Text>

        <View style={styles.heroMetaRow}>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>Member since {profile.memberSince}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your information</Text>

        <Pressable style={({ pressed }) => [styles.infoCard, pressed && styles.pressed]} onPress={() => openEditProfile("name")}>
          <View style={styles.infoLeading}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{profile.fullName}</Text>
          </View>
          <Text style={styles.rowArrow}>{">"}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.infoCard, styles.infoSpacing, pressed && styles.pressed]}
          onPress={() => openEditProfile("username")}
        >
          <View style={styles.infoLeading}>
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>@{profile.username.replace(/^@/, "")}</Text>
          </View>
          <Text style={styles.rowArrow}>{">"}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.infoCard, styles.infoSpacing, pressed && styles.pressed]}
          onPress={() => openEditProfile("email")}
        >
          <View style={styles.infoLeading}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile.email}</Text>
          </View>
          <Text style={styles.rowArrow}>{">"}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.infoCard, styles.infoSpacing, pressed && styles.pressed]}
          onPress={() => openEditProfile("password")}
        >
          <View style={styles.infoLeading}>
            <Text style={styles.infoLabel}>Password</Text>
            <Text style={styles.infoMuted}>Tap to update your password</Text>
          </View>
          <Text style={styles.rowArrow}>{">"}</Text>
        </Pressable>
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
          style={({ pressed }) => [styles.settingsRow, styles.infoSpacing, pressed && styles.pressed]}
          onPress={handleSignOut}
        >
          <Text style={[styles.settingsText, styles.signOutText]}>Log off</Text>
          <Text style={[styles.rowArrow, styles.signOutText]}>{">"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef3fb",
  },
  content: {
    padding: 18,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: "#1f4fa3",
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    shadowColor: "#0c2149",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 34,
    fontWeight: "800",
    color: "#1f4fa3",
  },
  name: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
  },
  username: {
    fontSize: 16,
    color: "#d7e4ff",
    marginTop: 4,
  },
  heroMetaRow: {
    marginTop: 16,
    flexDirection: "row",
  },
  metaPill: {
    borderRadius: 999,
    backgroundColor: "#315fb0",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  metaPillText: {
    color: "#edf3ff",
    fontSize: 13,
    fontWeight: "700",
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a2233",
    marginBottom: 10,
  },
  infoCard: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9e2f3",
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#16315f",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  infoSpacing: {
    marginTop: 10,
  },
  infoLeading: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: "#66758c",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    marginTop: 5,
    fontSize: 17,
    color: "#1a2233",
    fontWeight: "700",
  },
  infoMuted: {
    marginTop: 5,
    fontSize: 16,
    color: "#66758c",
  },
  rowArrow: {
    fontSize: 24,
    color: "#1f4fa3",
    marginLeft: 12,
  },
  settingsRow: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9e2f3",
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  settingsText: {
    fontSize: 17,
    color: "#1a2233",
    fontWeight: "700",
    flex: 1,
  },
  signOutText: {
    color: "#b33737",
  },
  pressed: {
    opacity: 0.86,
  },
});
