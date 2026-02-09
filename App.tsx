import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, Button } from "react-native";
import * as Location from "expo-location";
import { useState } from "react";

export default function App() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getLocation = async () => {
    // Request permission
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      setErrorMsg("Permission to access location was denied");
      return;
    }

    // Get current location
    const currentLocation = await Location.getCurrentPositionAsync({});
    setLocation(currentLocation);
    setErrorMsg(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Localisation App Benja Noé</Text>

      <Button title="Get / Refresh location" onPress={getLocation} />

      {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

      {location && (
        <Text style={styles.coords}>
          Latitude: {location.coords.latitude}{"\n"}
          Longitude: {location.coords.longitude}
        </Text>
      )}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
    fontWeight: "600",
  },
  coords: {
    marginTop: 15,
    textAlign: "center",
  },
  error: {
    marginTop: 15,
    color: "red",
  },
});
