import { NavigationContainer } from "@react-navigation/native";
import { NavigatorScreenParams } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import StartScreen from "./src/screens/StartScreen";
import EventsScreen from "./src/screens/EventsScreen";
import InboxScreen from "./src/screens/InboxScreen";
import CreateEventDetailsScreen from "./src/screens/CreateEventDetailsScreen";
import ChooseLocationScreen from "./src/screens/ChooseLocationScreen";
import InviteScreen from "./src/screens/InviteScreen";
import EventOverviewScreen from "./src/screens/EventOverviewScreen";
import MyProfileScreen from "./src/screens/MyProfileScreen";
import CreateProfileScreen from "./src/screens/CreateProfileScreen";
import NotificationSettingsScreen from "./src/screens/NotificationSettingsScreen";
import AttendingEventsScreen from "./src/screens/AttendingEventsScreen";
import HostingEventsScreen from "./src/screens/HostingEventsScreen";
import PastEventsScreen from "./src/screens/PastEventsScreen";


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
  CreateProfile: undefined;
  NotificationSettings: undefined;
  AttendingEvents: undefined;
  HostingEvents: undefined;
  PastEvents: undefined;
  CreateEventDetails: undefined;
  ChooseLocation: { eventName: string; eventTime: EventTime; eventDate: EventDate };
  InviteScreen: { eventName: string; location: EventLocation; eventTime: EventTime; eventDate: EventDate };
  EventOverview: { eventName: string; location: EventLocation; eventTime: EventTime; eventDate: EventDate };
};

export type MainTabParamList = {
  Start: undefined;
  Events: undefined;
  Inbox: undefined;
  MyProfile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

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
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="MainTabs">
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="CreateProfile" component={CreateProfileScreen} options={{ title: "Create profile" }} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: "Notifications" }} />
        <Stack.Screen name="AttendingEvents" component={AttendingEventsScreen} options={{ title: "Attending" }} />
        <Stack.Screen name="HostingEvents" component={HostingEventsScreen} options={{ title: "Hosting" }} />
        <Stack.Screen name="PastEvents" component={PastEventsScreen} options={{ title: "Past" }} />
        <Stack.Screen name="CreateEventDetails" component={CreateEventDetailsScreen} options={{ title: "Create event and time" }} />
        <Stack.Screen name="ChooseLocation" component={ChooseLocationScreen} options={{ title: "Location" }} />
        <Stack.Screen name="InviteScreen" component={InviteScreen} options={{ title: "Invite" }} />
        <Stack.Screen name="EventOverview" component={EventOverviewScreen}options={{ title: "Event" }}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

