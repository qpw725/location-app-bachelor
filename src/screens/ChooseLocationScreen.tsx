import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EventLocation, RootStackParamList } from "../../App";
import StepIndicator from "../components/StepIndicator";


type Props = NativeStackScreenProps<RootStackParamList, "ChooseLocation">;

export default function ChooseLocationScreen({ navigation, route }: Props) {
  const { eventName } = route.params;
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
    navigation.navigate("InviteScreen", { eventName, location: selected });
  }

  return (
    <View style={styles.container}>
      <StepIndicator step={2} total={3} label="Location" />
      <Text style={styles.title}>Choose location</Text>
      <Text style={styles.subtitle}>Event: {eventName}</Text>

      <TextInput
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          setSelected(null);
        }}
        placeholder="Search address or place (min 3 chars)"
        autoCorrect={false}
        style={styles.input}
      />

      {loading && (
        <View style={styles.row}>
          <ActivityIndicator />
          <Text style={styles.muted}> Searching...</Text>
        </View>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      {results.length > 0 && !selected && (
        <View style={styles.resultsBox}>
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={results}
            keyExtractor={(item) => String(item.place_id)}
            renderItem={({ item }) => (
              <Pressable onPress={() => pickPlace(item)} style={styles.resultItem}>
                <Text style={styles.resultText} numberOfLines={2}>
                  {item.display_name}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}

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
            <Text style={styles.muted}>Select a search result to preview it on the map</Text>
          </View>
        )}
      </View>

      {selected && (
        <View style={styles.selectedBox}>
          <Text style={styles.selectedTitle}>Selected</Text>
          <Text style={styles.selectedText} numberOfLines={2}>
            {selected.label}
          </Text>
          <Pressable onPress={() => setSelected(null)} style={styles.linkBtn}>
            <Text style={styles.linkText}>Change location</Text>
          </Pressable>
        </View>
      )}

      <Pressable onPress={goNext} disabled={!selected} style={[styles.nextBtn, !selected && styles.nextBtnDisabled]}>
        <Text style={styles.nextBtnText}>Continue to invites</Text>
      </Pressable>

      <View style={styles.spacerSmall} />

      <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backBtnText}>Back</Text>
      </Pressable>
    </View>
  );
}

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 10 },
  title: { fontSize: 24, fontWeight: "700" },
  subtitle: { fontSize: 14, opacity: 0.7 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  row: { flexDirection: "row", alignItems: "center" },
  muted: { color: "#666" },
  error: { color: "#b00020" },
  resultsBox: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    overflow: "hidden",
    maxHeight: 220,
  },
  resultItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f1f1",
  },
  resultText: { fontSize: 14 },
  mapWrap: { height: 260, borderRadius: 14, overflow: "hidden", position: "relative" },
  map: { flex: 1 },
  mapOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  selectedBox: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  selectedTitle: { fontWeight: "700" },
  selectedText: { color: "#333" },
  linkBtn: { alignSelf: "flex-start", paddingVertical: 6 },
  linkText: { color: "#1a73e8", fontWeight: "600" },
  nextBtn: {
    marginTop: "auto",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#111",
  },
  nextBtnDisabled: { backgroundColor: "#bbb" },
  nextBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  backBtn: { alignItems: "center", paddingVertical: 8 },
  backBtnText: { fontSize: 14, color: "#333" },
  spacer: { height: 16 },
  spacerSmall: { height: 10 },
});
