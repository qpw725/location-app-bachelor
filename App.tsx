import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import StartScreen from "./src/screens/StartScreen";
import MyInvitesScreen from "./src/screens/MyInvitesScreen";
import CreateEventScreen from "./src/screens/CreateEventScreen";
import ChooseLocationScreen from "./src/screens/ChooseLocationScreen";
import InviteScreen from "./src/screens/InviteScreen";
import EventOverviewScreen from "./src/screens/EventOverviewScreen";


export type EventLocation = {
  label: string;
  latitude: number;
  longitude: number;
};

export type EventTime = {
  hour: number;
  minute: number;
};

export type RootStackParamList = {
  Start: undefined;
  MyInvites: undefined;
  CreateEvent: undefined;
  ChooseLocation: { eventName: string; eventTime: EventTime };
  InviteScreen: { eventName: string; location: EventLocation; eventTime: EventTime };
  EventOverview: { eventName: string; location: EventLocation; eventTime: EventTime };
};


const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Start">
        <Stack.Screen name="Start" component={StartScreen} options={{ title: "Home" }} />
        <Stack.Screen name="MyInvites" component={MyInvitesScreen} options={{ title: "My invites" }} />
        <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ title: "Create event" }} />
        <Stack.Screen name="ChooseLocation" component={ChooseLocationScreen} options={{ title: "Location" }} />
        <Stack.Screen name="InviteScreen" component={InviteScreen} options={{ title: "Invite" }} />
        <Stack.Screen name="EventOverview" component={EventOverviewScreen}options={{ title: "Event" }}/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
