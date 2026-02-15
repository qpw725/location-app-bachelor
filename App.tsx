import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import CreateEventScreen from "./src/screens/CreateEventScreen";
import ChooseLocationScreen from "./src/screens/ChooseLocationScreen";

type RootStackParamList = {
  CreateEvent: undefined;
  ChooseLocation: undefined;
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
