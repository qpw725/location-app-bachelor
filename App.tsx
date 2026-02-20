import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import StartScreen from "./src/screens/StartScreen";
import InboxScreen from "./src/screens/InboxScreen";
import CreateEventDetailsScreen from "./src/screens/CreateEventDetailsScreen";
import ChooseLocationScreen from "./src/screens/ChooseLocationScreen";
import InviteScreen from "./src/screens/InviteScreen";
import EventOverviewScreen from "./src/screens/EventOverviewScreen";
import MyProfileScreen from "./src/screens/MyProfileScreen";


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
  Start: undefined;
  Inbox: undefined;
  MyProfile: undefined;
  CreateEventDetails: undefined;
  ChooseLocation: { eventName: string; eventTime: EventTime; eventDate: EventDate };
  InviteScreen: { eventName: string; location: EventLocation; eventTime: EventTime; eventDate: EventDate };
  EventOverview: { eventName: string; location: EventLocation; eventTime: EventTime; eventDate: EventDate };
};


const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Start">
        <Stack.Screen name="Start" component={StartScreen} options={{ title: "Home" }} />
        <Stack.Screen name="Inbox" component={InboxScreen} options={{ title: "Inbox" }} />
        <Stack.Screen name="MyProfile" component={MyProfileScreen} options={{ title: "My profile" }} />
        <Stack.Screen name="CreateEventDetails" component={CreateEventDetailsScreen} options={{ title: "Create event and time" }} />
        <Stack.Screen name="ChooseLocation" component={ChooseLocationScreen} options={{ title: "Location" }} />
        <Stack.Screen name="InviteScreen" component={InviteScreen} options={{ title: "Invite" }} />
        <Stack.Screen name="EventOverview" component={EventOverviewScreen}options={{ title: "Event" }}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}




