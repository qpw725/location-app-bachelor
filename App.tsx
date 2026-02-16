import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import CreateEventScreen from "./src/screens/CreateEventScreen";
import ChooseLocationScreen from "./src/screens/ChooseLocationScreen";
import InviteScreen from "./src/screens/InviteScreen";

export type RootStackParamList = {
  CreateEvent: undefined;
  ChooseLocation: { eventName: string };
  InviteScreen: { eventName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="CreateEvent">
        <Stack.Screen
          name="CreateEvent"
          component={CreateEventScreen}
          options={{ title: "Create event" }}
        />
        <Stack.Screen
          name="ChooseLocation"
          component={ChooseLocationScreen}
          options={{ title: "Location" }}
        />
        <Stack.Screen
          name="InviteScreen"
          component={InviteScreen}
          options={{ title: "Invite" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
