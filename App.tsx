import { NavigationContainer } from "@react-navigation/native";
import { NavigatorScreenParams } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import StartScreen from "./src/screens/StartScreen";
import InboxScreen from "./src/screens/InboxScreen";
import CreateEventDetailsScreen from "./src/screens/CreateEventDetailsScreen";
import ChooseLocationScreen from "./src/screens/ChooseLocationScreen";
import InviteScreen from "./src/screens/InviteScreen";
import EventOverviewScreen from "./src/screens/EventOverviewScreen";
import MyProfileScreen from "./src/screens/MyProfileScreen";
import CreateProfileScreen from "./src/screens/CreateProfileScreen";


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
  CreateEventDetails: undefined;
  ChooseLocation: { eventName: string; eventTime: EventTime; eventDate: EventDate };
  InviteScreen: { eventName: string; location: EventLocation; eventTime: EventTime; eventDate: EventDate };
  EventOverview: { eventName: string; location: EventLocation; eventTime: EventTime; eventDate: EventDate };
};

export type MainTabParamList = {
  Start: undefined;
  Inbox: undefined;
  MyProfile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Start" component={StartScreen} options={{ title: "Home", headerTitle: "Home"}} />
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
        <Stack.Screen name="CreateEventDetails" component={CreateEventDetailsScreen} options={{ title: "Create event and time" }} />
        <Stack.Screen name="ChooseLocation" component={ChooseLocationScreen} options={{ title: "Location" }} />
        <Stack.Screen name="InviteScreen" component={InviteScreen} options={{ title: "Invite" }} />
        <Stack.Screen name="EventOverview" component={EventOverviewScreen}options={{ title: "Event" }}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}




