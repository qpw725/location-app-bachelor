import React, { useEffect, useMemo, useRef, useState } from "react";
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
import type { EventLocation, RootStackParamList } from "../../App";
import StepIndicator from "../components/StepIndicator";

type Props = NativeStackScreenProps<RootStackParamList, "ChooseLocation">;

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

export default function ChooseLocationScreen({ navigation, route }: Props) {
  const { eventName, eventDescription, eventTime, eventEndTime, eventDate } = route.params;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EventLocation | null>(null);

  const cacheRef = useRef<Map<string, NominatimResult[]>>(new Map());
  const requestSeq = useRef(0);

  const canSearch = query.trim().length >= 3;

  useEffect(() => {
    setError(null);

    if (!canSearch) {
      setLoading(false);
      setResults([]);
      return;
    }

    const q = query.trim().toLowerCase();
    let seq = 0;

    const handle = setTimeout(async () => {
      const cached = cacheRef.current.get(q);
      if (cached) {
        setResults(cached);
        return;
      }

      seq = ++requestSeq.current;
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
            "User-Agent": "UCPH-EventApp/1.0 (student project)",
          },
        });

        if (!res.ok) {
          throw new Error(`Search failed (${res.status})`);
        }

        const data = (await res.json()) as NominatimResult[];

        if (seq !== requestSeq.current) return;

        cacheRef.current.set(q, data);
        setResults(data);
      } catch (e: unknown) {
        if (seq !== requestSeq.current) return;
        setResults([]);
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
        }
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [query, canSearch]);

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
    navigation.navigate("EventOverview", { eventName, eventDescription, location: selected, eventTime, eventEndTime, eventDate });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <StepIndicator step={2} total={3} label="Location" />

      <View style={styles.heroCard}>
        <Text style={styles.title}>Pick where it should happen</Text>
        <Text style={styles.subtitle}>Search for a place, preview it on the map, and confirm the spot for {eventName}.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Search location</Text>
        <TextInput
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setSelected(null);
          }}
          placeholder="Search address or place"
          placeholderTextColor="#8a7f74"
          autoCorrect={false}
          style={styles.input}
        />

        {loading && (
          <View style={styles.row}>
            <ActivityIndicator color="#2f5d50" />
            <Text style={styles.muted}>Searching...</Text>
          </View>
        )}

        {!!error && <Text style={styles.error}> {error}</Text>}

        {results.length > 0 && !selected && (
          <View style={styles.resultsBox}>
            <FlatList
              scrollEnabled={false}
              keyboardShouldPersistTaps="handled"
              data={results}
              keyExtractor={(item) => String(item.place_id)}
              renderItem={({ item }) => (
                <Pressable onPress={() => pickPlace(item)} style={({ pressed }) => [styles.resultItem, pressed && styles.pressed]}>
                  <Text style={styles.resultText} numberOfLines={2}>
                    {item.display_name}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Map preview</Text>
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
              <Text style={styles.muted}>Select a search result to preview it on the map.</Text>
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

      <Pressable onPress={goNext} disabled={!selected} style={[styles.nextBtn, !selected && styles.nextBtnDisabled]}>
        <Text style={styles.nextBtnText}>Continue to finalize</Text>
      </Pressable>

      <View style={styles.spacerSmall} />

      <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
        <Text style={styles.backBtnText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f1e8" },
  content: { padding: 20, paddingBottom: 120 },
  heroCard: {
    backgroundColor: "#fffaf4",
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eadfce",
    shadowColor: "#7a5c3d",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  title: { fontSize: 28, fontWeight: "800", color: "#1f1a17", marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, color: "#67594d" },
  card: {
    backgroundColor: "#fffaf4",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfce",
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#201c19", marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#201c19",
    backgroundColor: "#fffaf4",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  muted: { color: "#6f6258", fontSize: 13 },
  error: {
    color: "#a23d3d",
    backgroundColor: "#fff4f1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    fontSize: 13,
    fontWeight: "600",
  },
  resultsBox: {
    borderWidth: 1,
    borderColor: "#eadfce",
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 12,
  },
  resultItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#efe4d7",
    backgroundColor: "#fffaf4",
  },
  resultText: { fontSize: 14, color: "#201c19", lineHeight: 20 },
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
    borderColor: "#eadfce",
    borderRadius: 16,
    padding: 12,
    gap: 6,
    marginTop: 12,
    backgroundColor: "#fff6ea",
  },
  selectedTitle: { fontWeight: "700", color: "#201c19" },
  selectedText: { color: "#5f5145", lineHeight: 20 },
  linkBtn: { alignSelf: "flex-start", paddingVertical: 6 },
  linkText: { color: "#9d5c2f", fontWeight: "700" },
  nextBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "#2f5d50",
  },
  nextBtnDisabled: { backgroundColor: "#97aa9f" },
  nextBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  backBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  backBtnText: { fontSize: 14, color: "#4f4339", fontWeight: "700" },
  spacerSmall: { height: 10 },
  pressed: { opacity: 0.86 },
});
