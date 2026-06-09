import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EventLocation, RootStackParamList } from "../../../App";
import StepIndicator from "../../components/StepIndicator";
import { colors, commonStyles } from "../../styles/common";

type Props = NativeStackScreenProps<RootStackParamList, "CreateEventLocation">;

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

export default function CreateEventLocationScreen({ navigation, route }: Props) {
  const { eventName, eventDescription, eventTime, eventEndTime, eventDate } = route.params;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EventLocation | null>(null);

  useEffect(() => {
    let isMounted = true;
    setError(null);

    const canSearch = query.trim().length >= 3;

    if (!canSearch) {
      setLoading(false);
      setResults([]);
      return () => {
        isMounted = false;
      };
    }

    const q = query.trim().toLowerCase();

    const handle = setTimeout(async () => {
      setLoading(true);

      try {
        const url =
          "https://nominatim.openstreetmap.org/search" +
          `?q=${encodeURIComponent(q)}` +
          "&format=json" +
          "&addressdetails=1" +
          "&limit=6";

        const res = await fetch(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "EventApp/1.0 (student project)",
          },
        });

        if (!res.ok) {
          throw new Error(`Search failed (${res.status})`);
        }

        const data = (await res.json()) as NominatimResult[];

        if (isMounted) {
          setResults(data);
        }
      } catch (e: unknown) {
        if (isMounted) {
          setResults([]);
          setError(e instanceof Error ? e.message : "Something went wrong.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(handle);
    };
  }, [query]);

  const region = useMemo<Region>(() => {
    if (selected) {
      return {
        latitude: selected.latitude,
        longitude: selected.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    return {
      latitude: 55.6761,
      longitude: 12.5683,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }, [selected]);

  function pickPlace(item: NominatimResult) {
    const latitude = Number(item.lat);
    const longitude = Number(item.lon);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setError("Invalid location from search result.");
      return;
    }

    setSelected({
      label: item.display_name,
      latitude,
      longitude,
    });
    setResults([]);
  }

  function goNext() {
    if (!selected) return;
    navigation.navigate("CreateEventInvite", { eventName, eventDescription, location: selected, eventTime, eventEndTime, eventDate });
  }

  return (
    <ScrollView style={commonStyles.screen} contentContainerStyle={commonStyles.scrollContent} keyboardShouldPersistTaps="handled">
      <StepIndicator step={2} total={3} label="Location" />

      <View style={commonStyles.heroCard}>
        <Text style={commonStyles.heroTitle}>Pick where it should happen</Text>
        <Text style={commonStyles.heroSubtitle}>Search for a place, preview it on the map, and confirm the spot for {eventName}.</Text>
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Search location</Text>
        <TextInput
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setSelected(null);
          }}
          placeholder="Search address or place"
          placeholderTextColor="#8a7f74"
          autoCorrect={false}
          style={commonStyles.input}
        />

        {loading && (
          <View style={styles.row}>
            <ActivityIndicator color={colors.primary} />
            <Text style={commonStyles.mutedText}>Searching...</Text>
          </View>
        )}

        {!!error && <Text style={commonStyles.errorText}> {error}</Text>}

        {results.length > 0 && !selected && (
          <View style={styles.resultsBox}>
            <FlatList
              scrollEnabled={false}
              keyboardShouldPersistTaps="handled"
              data={results}
              keyExtractor={(item) => String(item.place_id)}
              renderItem={({ item }) => (
                <Pressable onPress={() => pickPlace(item)} style={({ pressed }) => [styles.resultItem, pressed && commonStyles.pressed]}>
                  <Text style={styles.resultText} numberOfLines={2}>
                    {item.display_name}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        )}
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Map preview</Text>
        <View style={styles.mapWrap}>
          <MapView style={styles.map} region={region}>
            {selected && (
              <Marker
                coordinate={{ latitude: selected.latitude, longitude: selected.longitude }}
                title="Selected location"
                description={selected.label}
              />
            )}
          </MapView>

          {!selected && (
            <View style={styles.mapOverlay}>
              <Text style={commonStyles.mutedText}>Select a search result to preview it on the map.</Text>
            </View>
          )}
        </View>

        {selected && (
          <View style={styles.selectedBox}>
            <Text style={styles.selectedTitle}>Selected location</Text>
            <Text style={styles.selectedText} numberOfLines={2}>
              {selected.label}
            </Text>
            <Pressable onPress={() => setSelected(null)} style={styles.linkBtn}>
              <Text style={styles.linkText}>Change location</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Pressable onPress={goNext} disabled={!selected} style={[commonStyles.primaryButton, !selected && commonStyles.primaryButtonDisabled]}>
        <Text style={commonStyles.primaryButtonText}>Continue to finalize</Text>
      </Pressable>

      <View style={styles.spacerSmall} />

      <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [commonStyles.backButton, pressed && commonStyles.pressed]}>
        <Text style={commonStyles.backButtonText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  resultsBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 12,
  },
  resultItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  resultText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  mapWrap: { height: 260, borderRadius: 16, overflow: "hidden", position: "relative" },
  map: { flex: 1 },
  mapOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    backgroundColor: "rgba(255,250,244,0.92)",
  },
  selectedBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    gap: 6,
    marginTop: 12,
    backgroundColor: colors.surfaceMuted,
  },
  selectedTitle: { fontWeight: "700", color: colors.text },
  selectedText: { color: "#5f5145", lineHeight: 20 },
  linkBtn: { alignSelf: "flex-start", paddingVertical: 6 },
  linkText: { color: colors.link, fontWeight: "700" },
  spacerSmall: { height: 10 },
});
