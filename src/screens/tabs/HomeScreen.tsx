import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../../../App";
import { useCallback, useEffect, useState } from "react";
import { fetchHomeActivity, fetchHomeOverview, type HomeActivityItem } from "../../data/eventStore";
import { fetchCurrentProfile } from "../../profile";
import { colors, commonStyles } from "../../styles/common";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Home">,
  NativeStackScreenProps<RootStackParamList>
>;



export default function HomeScreen({ navigation }: Props) {
  const [displayName, setDisplayName] = useState("there");
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [hostingCount, setHostingCount] = useState(0);
  const [activityItems, setActivityItems] = useState<HomeActivityItem[]>([]);

  useEffect(() => {
    fetchCurrentProfile().then(({ profile }) => {
      if (!profile) {
        return;
      }

      setDisplayName(profile.fullName !== "No name found" ? profile.fullName : profile.username);
    });
  }, []);

  const loadOverview = useCallback(async () => {
    const [{ data: overviewData }, { data: activityData }] = await Promise.all([
      fetchHomeOverview(),
      fetchHomeActivity(),
    ]);

    if (!overviewData) {
      return;
    }
    setUpcomingCount(overviewData.upcomingCount);
    setPendingInviteCount(overviewData.pendingInviteCount);
    setHostingCount(overviewData.hostingCount);
    setActivityItems(activityData ?? []);
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useFocusEffect(
    useCallback(() => {
      void loadOverview();
    }, [loadOverview])
  );

  const overviewStats = [
    { label: "Upcoming", value: upcomingCount, cardStyle: styles.statCardWarm },
    { label: "Pending", value: pendingInviteCount, cardStyle: styles.statCardCool },
    { label: "Hosting", value: hostingCount, cardStyle: styles.statCardNeutral },
  ];

  return (
    <ScrollView style={commonStyles.screen} contentContainerStyle={commonStyles.scrollContent}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Home</Text>
        <Text style={styles.title}>Hi, {displayName}</Text>
        <Text style={styles.heroText}>Plan, host, and participate in events.</Text>
        <Pressable
          style={({ pressed }) => [styles.primaryCard, pressed && commonStyles.pressed]}
          onPress={() => navigation.navigate("CreateEventDetails")}
        >
          <View style={styles.primaryCardContent}>
            <View>
              <Text style={styles.primaryCardTitle}>Create event</Text>
              <Text style={styles.primaryCardText}>Set the details, time, and location in a few taps.</Text>
            </View>
            <Text style={styles.primaryCardArrow}>+</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <Pressable onPress={() => navigation.navigate("MyEvents")}>
            <Text style={styles.sectionAction}>View events</Text>
          </Pressable>
        </View>
        <View style={styles.statsRow}>
          {overviewStats.map((stat) => (
            <View key={stat.label} style={[styles.statCard, stat.cardStyle]}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>What's new?</Text>
          <Pressable onPress={() => navigation.navigate("Inbox")}>
            <Text style={styles.sectionAction}>View inbox</Text>
          </Pressable>
        </View>

        {activityItems.length === 0 ? (
          <View style={styles.activityCard}>
            <Text style={styles.activityTitle}>No unanswered invites right now</Text>
            <Text style={styles.activityText}>New friend requests and event invites will appear here.</Text>
          </View>
        ) : (
          activityItems.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => navigation.navigate("Inbox")}
              style={({ pressed }) => [styles.activityCard, pressed && commonStyles.pressed]}
            >
              <View style={styles.activityHeader}>
                <Text style={styles.activityBadge}>
                  {item.type === "event_invite" ? "Event invite" : "Friend request"}
                </Text>
              </View>
              <Text style={styles.activityTitle}>{item.title}</Text>
              <Text style={styles.activityText}>{item.subtitle}</Text>
              <Text style={styles.activityMeta}>{item.meta}</Text>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: "relative",
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  eyebrow: {
    color: "#8a6a4a",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: { color: colors.textStrong, fontSize: 30, fontWeight: "800", marginBottom: 8 },
  heroText: {
    color: colors.textSubtle,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: "80%",
  },
  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 10 },
  sectionAction: { fontSize: 14, fontWeight: "700", color: colors.link },
  primaryCard: {
    marginTop: 18,
    backgroundColor: colors.primary,
    borderRadius: 22,
    padding: 18,
  },
  primaryCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  primaryCardEyebrow: {
    color: "#cfe0d8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  primaryCardTitle: { color: "#ffffff", fontSize: 22, fontWeight: "700", marginBottom: 4 },
  primaryCardText: { color: "#d9e8e1", fontSize: 14, lineHeight: 20, maxWidth: 220 },
  primaryCardArrow: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "300",
    lineHeight: 32,
  },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statCardWarm: {
    backgroundColor: colors.surface,
  },
  statCardCool: {
    backgroundColor: colors.surface,
  },
  statCardNeutral: {
    backgroundColor: colors.surface,
  },
  statValue: { fontSize: 24, fontWeight: "800", color: "#241f1c" },
  statLabel: { marginTop: 5, fontSize: 12, color: colors.textMuted },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  activityHeader: { marginBottom: 8 },
  activityBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#efe3d3",
    color: "#84502a",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "700",
  },
  activityTitle: { color: "#241f1c", fontSize: 16, fontWeight: "700", marginBottom: 4 },
  activityText: { color: colors.textSubtle, fontSize: 14, lineHeight: 20 },
  activityMeta: { color: "#4e6258", fontSize: 12, fontWeight: "600", marginTop: 8 },
});
