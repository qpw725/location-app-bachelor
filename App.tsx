import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { NavigatorScreenParams } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { Session } from "@supabase/supabase-js";
import Ionicons from "@expo/vector-icons/Ionicons";

import StartScreen from "./src/screens/StartScreen";
import EventsScreen from "./src/screens/EventsScreen";
import InboxScreen from "./src/screens/InboxScreen";
import CreateEventDetailsScreen from "./src/screens/CreateEventDetailsScreen";
import ChooseLocationScreen from "./src/screens/ChooseLocationScreen";
import EventOverviewScreen from "./src/screens/EventOverviewScreen";
import MyProfileScreen from "./src/screens/MyProfileScreen";
import EditProfileScreen from "./src/screens/EditProfileScreen";
import NotificationSettingsScreen from "./src/screens/NotificationSettingsScreen";
import AttendingEventsScreen from "./src/screens/AttendingEventsScreen";
import HostingEventsScreen from "./src/screens/HostingEventsScreen";
import PastEventsScreen from "./src/screens/PastEventsScreen";
import EventMapScreen from "./src/screens/EventMapScreen";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import RegisterProfileScreen from "./src/screens/RegisterProfileScreen";
import { initializeEventLocationSharing } from "./src/locationSharingManager";
import { supabase } from "./src/supabase";


export type EventLocation = {
  label: string;
  latitude: number;
  longitude: number;
};

export type EventTime = {
  hour: number;
  minute: number;
};

export type EventDate = {
  year: number;
  month: number;
  day: number;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  NotificationSettings: undefined;
  EditProfile:
    | {
        initialField?: "username" | "name" | "email" | "password";
      }
    | undefined;
  AttendingEvents: undefined;
  HostingEvents: undefined;
  PastEvents: undefined;
  CreateEventDetails: undefined;
  ChooseLocation: { eventName: string; eventDescription?: string; eventTime: EventTime; eventEndTime: EventTime; eventDate: EventDate };
  EventOverview: {
    eventName: string;
    eventDescription?: string;
    location: EventLocation;
    eventTime: EventTime;
    eventEndTime: EventTime;
    eventDate: EventDate;
  };
  EventMap: {
    eventId: string;
    eventTitle: string;
  };
};

export type MainTabParamList = {
  Start: undefined;
  Events: undefined;
  Inbox: undefined;
  MyProfile: undefined;
};

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  RegisterProfile: {
    email: string;
    password: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

const sharedHeaderOptions = {
  headerStyle: {
    backgroundColor: "#f7f1e8",
  },
  headerShadowVisible: false,
  headerTintColor: "#3f352d",
  headerTitleStyle: {
    color: "#201c19",
    fontSize: 18,
    fontWeight: "700" as const,
  },
  headerBackTitleStyle: {
    color: "#6f6258",
    fontSize: 14,
    fontWeight: "500" as const,
  },
  headerBackTitleVisible: false,
};

function AuthScreens() {
  return (
    <AuthStack.Navigator screenOptions={sharedHeaderOptions}>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: "Login" }} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: "Register" }} />
      <AuthStack.Screen name="RegisterProfile" component={RegisterProfileScreen} options={{ title: "Register" }} />
    </AuthStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home";

          if (route.name === "Start") {
            iconName = "home";
          } else if (route.name === "Events") {
            iconName = "calendar";
          } else if (route.name === "Inbox") {
            iconName = "mail";
          } else if (route.name === "MyProfile") {
            iconName = "person";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#2f6fed",
        tabBarInactiveTintColor: "#8a94a6",
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIconStyle: styles.tabBarIcon,
        tabBarItemStyle: styles.tabBarItem,
        tabBarStyle: styles.tabBar,
        ...sharedHeaderOptions,
      })}
    >
      <Tab.Screen name="Start" component={StartScreen} options={{ title: "Home", headerTitle: "Home" }} />
      <Tab.Screen name="Events" component={EventsScreen} options={{ title: "Events", headerTitle: "Events" }} />
      <Tab.Screen name="Inbox" component={InboxScreen} options={{ title: "Inbox", headerTitle: "Inbox" }} />
      <Tab.Screen name="MyProfile" component={MyProfileScreen} options={{ title: "Profile", headerTitle: "My profile" }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    if (!session) {
      return;
    }

    void initializeEventLocationSharing();
  }, [session]);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        setSession(currentSession);
      } catch (error: unknown) {
        if (!isMounted) {
          return;
        }

        console.error("[App] Failed to load auth session:", error);
        setSession(null);
      } finally {
        if (isMounted) {
          setIsLoadingSession(false);
        }
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      setSession(activeSession);
      setIsLoadingSession(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isLoadingSession) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? (
        <Stack.Navigator initialRouteName="MainTabs" screenOptions={sharedHeaderOptions}>
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="NotificationSettings"
            component={NotificationSettingsScreen}
            options={{ title: "Notifications", headerBackTitle: "Profile" }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ title: "Edit profile", headerBackTitle: "Profile" }}
          />
          <Stack.Screen
            name="AttendingEvents"
            component={AttendingEventsScreen}
            options={{ title: "Attending", headerBackTitle: "Events" }}
          />
          <Stack.Screen
            name="HostingEvents"
            component={HostingEventsScreen}
            options={{ title: "Hosting", headerBackTitle: "Events" }}
          />
          <Stack.Screen
            name="PastEvents"
            component={PastEventsScreen}
            options={{ title: "Past", headerBackTitle: "Events" }}
          />
          <Stack.Screen
            name="CreateEventDetails"
            component={CreateEventDetailsScreen}
            options={{ title: "Create event and time", headerBackTitle: "Home" }}
          />
          <Stack.Screen
            name="ChooseLocation"
            component={ChooseLocationScreen}
            options={{ title: "Location", headerBackTitle: "Event details" }}
          />
          <Stack.Screen
            name="EventOverview"
            component={EventOverviewScreen}
            options={{ title: "Event", headerBackTitle: "Location" }}
          />
          <Stack.Screen
            name="EventMap"
            component={EventMapScreen}
            options={{ title: "Event map", headerBackTitle: "Events" }}
          />
        </Stack.Navigator>
      ) : (
        <AuthScreens />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    marginHorizontal: 28,
    bottom: 24,
    height: 74,
    borderTopWidth: 0,
    borderRadius: 34,
    backgroundColor: "#fdfdfd",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 10 : 12,
    elevation: 10,
    shadowColor: "#0f172a",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  tabBarItem: {
    borderRadius: 24,
    marginHorizontal: 4,
    paddingVertical: 4,
  },
  tabBarIcon: {
    marginBottom: 2,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
});
