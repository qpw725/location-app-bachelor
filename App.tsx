import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { NavigatorScreenParams } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { Session } from "@supabase/supabase-js";

import StartScreen from "./src/screens/StartScreen";
import EventsScreen from "./src/screens/EventsScreen";
import InboxScreen from "./src/screens/InboxScreen";
import CreateEventDetailsScreen from "./src/screens/CreateEventDetailsScreen";
import ChooseLocationScreen from "./src/screens/ChooseLocationScreen";
import EventOverviewScreen from "./src/screens/EventOverviewScreen";
import MyProfileScreen from "./src/screens/MyProfileScreen";
import NotificationSettingsScreen from "./src/screens/NotificationSettingsScreen";
import AttendingEventsScreen from "./src/screens/AttendingEventsScreen";
import HostingEventsScreen from "./src/screens/HostingEventsScreen";
import PastEventsScreen from "./src/screens/PastEventsScreen";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import RegisterProfileScreen from "./src/screens/RegisterProfileScreen";
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

function AuthScreens() {
  return (
    <AuthStack.Navigator>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: "Login" }} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: "Register" }} />
      <AuthStack.Screen name="RegisterProfile" component={RegisterProfileScreen} options={{ title: "Register" }} />
    </AuthStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator>
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
        <Stack.Navigator initialRouteName="MainTabs">
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="NotificationSettings"
            component={NotificationSettingsScreen}
            options={{ title: "Notifications", headerBackTitle: "Profile" }}
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
        </Stack.Navigator>
      ) : (
        <AuthScreens />
      )}
    </NavigationContainer>
  );
}
