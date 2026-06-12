import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { NavigatorScreenParams } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Session } from "@supabase/supabase-js";
import Ionicons from "@expo/vector-icons/Ionicons";

import HomeScreen from "./src/screens/tabs/HomeScreen";
import MyEventsScreen from "./src/screens/tabs/MyEventsScreen";
import DiscoverEventsScreen from "./src/screens/tabs/DiscoverEventsScreen";
import InboxScreen from "./src/screens/tabs/InboxScreen";
import CreateEventDetailsScreen from "./src/screens/create-event/CreateEventDetailsScreen";
import CreateEventLocationScreen from "./src/screens/create-event/CreateEventLocationScreen";
import CreateEventInviteScreen from "./src/screens/create-event/CreateEventInviteScreen";
import CreateEventAttendanceScreen from "./src/screens/create-event/CreateEventAttendanceScreen";
import ProfileScreen from "./src/screens/tabs/ProfileScreen";
import EditProfileScreen from "./src/screens/profile/EditProfileScreen";
import AttendingEventsScreen from "./src/screens/events/AttendingEventsScreen";
import HostingEventsScreen from "./src/screens/events/HostingEventsScreen";
import PastEventsScreen from "./src/screens/events/PastEventsScreen";
import EventDetailsScreen from "./src/screens/events/EventDetailsScreen";
import LiveEventMapScreen from "./src/screens/events/LiveEventMapScreen";
import LoginScreen from "./src/screens/auth/LoginScreen";
import RegisterScreen from "./src/screens/auth/RegisterScreen";
import RegisterProfileScreen from "./src/screens/auth/RegisterProfileScreen";
import { startOpenAppEventPresenceTracking, stopOpenAppEventPresenceTracking } from "./src/eventPresenceManager";
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

export type EventAttendanceMethod = "gps_geofence";

export type EventInvitee = {
  id: string;
  username: string;
  name?: string;
  avatarUrl?: string | null;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  EditProfile:
    | {
        initialField?: "username" | "name" | "email" | "password";
      }
    | undefined;
  AttendingEvents: undefined;
  HostingEvents: undefined;
  PastEvents: undefined;
  EventDetails: {
    eventId: string;
    source: "attending" | "hosting" | "past";
  };
  CreateEventDetails: undefined;
  CreateEventLocation: { eventName: string; eventDescription?: string; eventTime: EventTime; eventEndTime: EventTime; eventDate: EventDate };
  CreateEventInvite: {
    eventName: string;
    eventDescription?: string;
    location: EventLocation;
    eventTime: EventTime;
    eventEndTime: EventTime;
    eventDate: EventDate;
  };
  CreateEventAttendance: {
    eventName: string;
    eventDescription?: string;
    location: EventLocation;
    eventTime: EventTime;
    eventEndTime: EventTime;
    eventDate: EventDate;
    visibility: "Private" | "Public";
    selectedCategory: string;
    invitedPeople: EventInvitee[];
  };
  LiveEventMap: {
    eventId: string;
    eventTitle: string;
  };
};

export type MainTabParamList = {
  Home: undefined;
  MyEvents: undefined;
  DiscoverEvents: undefined;
  Inbox: undefined;
  Profile: undefined;
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

          if (route.name === "Home") {
            iconName = "home";
          } else if (route.name === "MyEvents") {
            iconName = "calendar";
          } else if (route.name === "DiscoverEvents") {
            iconName = "search";
          } else if (route.name === "Inbox") {
            iconName = "mail";
          } else if (route.name === "Profile") {
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Home", headerTitle: "Home" }} />
      <Tab.Screen name="MyEvents" component={MyEventsScreen} options={{ title: "My Events", headerTitle: "My Events" }} />
      <Tab.Screen name="DiscoverEvents" component={DiscoverEventsScreen} options={{ title: "Discover", headerTitle: "Discover" }} />
      <Tab.Screen name="Inbox" component={InboxScreen} options={{ title: "Inbox", headerTitle: "Inbox" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile", headerTitle: "Profile" }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    if (!session) {
      stopOpenAppEventPresenceTracking();
      return;
    }

    void startOpenAppEventPresenceTracking();

    return () => {
      stopOpenAppEventPresenceTracking();
    };
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
            name="EventDetails"
            component={EventDetailsScreen}
            options={{ title: "Event details", headerBackTitle: "Events" }}
          />
          <Stack.Screen
            name="CreateEventDetails"
            component={CreateEventDetailsScreen}
            options={{ title: "Create event and time", headerBackTitle: "Home" }}
          />
          <Stack.Screen
            name="CreateEventLocation"
            component={CreateEventLocationScreen}
            options={{ title: "Location", headerBackTitle: "Event details" }}
          />
          <Stack.Screen
            name="CreateEventInvite"
            component={CreateEventInviteScreen}
            options={{ title: "Event", headerBackTitle: "Location" }}
          />
          <Stack.Screen
            name="CreateEventAttendance"
            component={CreateEventAttendanceScreen}
            options={{ title: "GPS features", headerBackTitle: "Event" }}
          />
          <Stack.Screen
            name="LiveEventMap"
            component={LiveEventMapScreen}
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
    paddingBottom: 10,
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
