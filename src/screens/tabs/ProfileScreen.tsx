import { useCallback, useState } from "react";
import { Alert, View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../../../App";
import ProfileAvatar from "../../components/ProfileAvatar";
import { CurrentProfile, fetchCurrentProfile, getProfileInitials, pickAndUploadAvatar, removeAvatar } from "../../profile";
import { supabase } from "../../supabase";
import { colors, commonStyles } from "../../styles/common";

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, "Profile">, NativeStackScreenProps<RootStackParamList>>;

const defaultProfile: CurrentProfile = {
  id: "",
  email: "No email found",
  fullName: "No name found",
  firstName: "",
  lastName: "",
  username: "No username found",
  memberSince: "Unknown",
  avatarPath: null,
  avatarUrl: null,
};

export default function ProfileScreen({ navigation }: Props) {
  const [profile, setProfile] = useState<CurrentProfile>(defaultProfile);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const loadProfile = useCallback(async () => {
    const { profile: currentProfile, error } = await fetchCurrentProfile();

    if (error) {
      setErrorMessage(error);
      return;
    }

    if (currentProfile) {
      setProfile(currentProfile);
      setErrorMessage(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const initials = getProfileInitials(profile.fullName, profile.username);

  function openEditProfile() {
    navigation.navigate("EditProfile");
  }

  function promptForAvatarChange() {
    if (!profile.id || isUploadingAvatar) {
      return;
    }

    Alert.alert("Change profile photo", "Choose how you want to update your avatar.", [
      { text: "Cancel", style: "cancel" },
      { text: "Choose photo", onPress: () => void handleAvatarChange("library") },
      { text: "Take photo", onPress: () => void handleAvatarChange("camera") },
      ...(profile.avatarPath ? [{ text: "Remove photo", style: "destructive" as const, onPress: () => void handleAvatarRemove() }] : []),
    ]);
  }

  async function handleAvatarChange(source: "camera" | "library") {
    if (!profile.id) {
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarMessage(null);

    const result = await pickAndUploadAvatar({
      source,
      userId: profile.id,
      currentAvatarPath: profile.avatarPath,
    });

    setIsUploadingAvatar(false);

    if (result.error) {
      setAvatarMessage(result.error);
      return;
    }

    if (!result.cancelled) {
      setProfile((current) => ({
        ...current,
        avatarPath: result.avatarPath,
        avatarUrl: result.avatarUrl,
      }));
    }
  }

  async function handleAvatarRemove() {
    if (!profile.id) {
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarMessage(null);

    const result = await removeAvatar({
      userId: profile.id,
      currentAvatarPath: profile.avatarPath,
    });

    setIsUploadingAvatar(false);

    if (result.error) {
      setAvatarMessage(result.error);
      return;
    }

    setProfile((current) => ({
      ...current,
      avatarPath: null,
      avatarUrl: null,
    }));
  }

  return (
    <ScrollView style={commonStyles.screen} contentContainerStyle={commonStyles.scrollContent}>
      <View style={styles.heroCard}>
        <Text style={[commonStyles.heroEyebrow, styles.heroEyebrow]}>Profile</Text>
        <ProfileAvatar
          avatarUrl={profile.avatarUrl}
          initials={initials}
          size={142}
          onPress={promptForAvatarChange}
          isUploading={isUploadingAvatar}
        />
        <Text style={styles.avatarHint}>Tap your photo to change it</Text>

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

        <View style={styles.infoPanel}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{profile.fullName}</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>@{profile.username.replace(/^@/, "")}</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile.email}</Text>
          </View>
        </View>

        <Pressable style={({ pressed }) => [commonStyles.primaryButton, styles.editButton, pressed && commonStyles.pressed]} onPress={openEditProfile}>
          <Text style={commonStyles.primaryButtonText}>Edit profile</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <Pressable
          style={({ pressed }) => [styles.settingsRow, pressed && commonStyles.pressed]}
          onPress={handleSignOut}
        >
          <Text style={[styles.settingsText, styles.signOutText]}>Log off</Text>
        </Pressable>
      </View>

      {errorMessage ? <Text style={commonStyles.errorText}>{errorMessage}</Text> : null}
      {avatarMessage ? <Text style={commonStyles.successText}>{avatarMessage}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  heroEyebrow: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  avatarHint: {
    color: colors.textMuted,
    marginTop: 10,
    fontSize: 13,
    fontWeight: "600",
  },
  name: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textStrong,
    textAlign: "center",
  },
  username: {
    fontSize: 16,
    color: colors.textSubtle,
    marginTop: 4,
  },
  heroMetaRow: {
    marginTop: 16,
    flexDirection: "row",
  },
  metaPill: {
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaPillText: {
    color: "#5f5145",
    fontSize: 13,
    fontWeight: "700",
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 10,
  },
  infoPanel: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  infoRow: {
    paddingVertical: 6,
    width: "100%",
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    marginTop: 5,
    fontSize: 17,
    color: colors.text,
    fontWeight: "700",
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: 12,
  },
  editButton: {
    marginTop: 12,
  },
  settingsRow: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  settingsText: {
    fontSize: 17,
    color: colors.text,
    fontWeight: "700",
    flex: 1,
  },
  signOutText: {
    color: "#b33737",
  },
});
