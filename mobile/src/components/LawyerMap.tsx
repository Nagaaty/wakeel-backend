// ─── LawyerMap Component — Sprint 6 ──────────────────────────────────────────
// Shows lawyer office location + user location on an interactive map.
// Used in: lawyer/[id].tsx (in-person tab), book.tsx (inperson service summary)
import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, Linking,
  ActivityIndicator, Platform,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { useTheme } from "../theme";
import { useI18n } from "../i18n";

interface Props {
  lawyerName:  string;
  officeAddress: string;
  // If coordinates provided, use them directly
  latitude?:   number;
  longitude?:  number;
  // Height of map view
  height?:     number;
}

// ── Fallback geocode via Nominatim (free, no API key) ─────────────────────────
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = encodeURIComponent(address + ", Egypt");
    const res   = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
      headers: { "User-Agent": "Wakeel.eg/1.0" },
    });
    const data = await res.json();
    if (data?.[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

export function LawyerMap({ lawyerName, officeAddress, latitude, longitude, height = 220 }: Props) {
  const C      = useTheme();
  const { isRTL } = useI18n();
  const [coords, setCoords]   = useState<{ lat: number; lng: number } | null>(
    latitude && longitude ? { lat: latitude, lng: longitude } : null
  );
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(!coords);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (coords) return;
    setLoading(true);
    geocodeAddress(officeAddress)
      .then(c => {
        if (c) setCoords(c);
        else   setError(isRTL ? "تعذر تحديد الموقع" : "Location not found");
      })
      .finally(() => setLoading(false));
  }, [officeAddress]);

  // Get user location for directions distance
  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === "granted") {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .then(loc => setUserLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude }))
          .catch(() => {});
      }
    });
  }, []);

  const openInMaps = () => {
    if (!coords) return;
    const label = encodeURIComponent(lawyerName);
    const url   = Platform.OS === "ios"
      ? `maps:?q=${label}&ll=${coords.lat},${coords.lng}`
      : `geo:${coords.lat},${coords.lng}?q=${label}`;
    Linking.openURL(url).catch(() => {
      // Fallback to Google Maps web
      Linking.openURL(`https://maps.google.com/?q=${coords.lat},${coords.lng}`);
    });
  };

  if (loading) return (
    <View style={{ height, backgroundColor: C.card, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border }}>
      <ActivityIndicator color={C.gold} />
      <Text style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>
        {isRTL ? "جاري تحميل الخريطة..." : "Loading map..."}
      </Text>
    </View>
  );

  if (error || !coords) return (
    <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border }}>
      <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 24 }}>📍</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontWeight: "600", fontSize: 14 }} numberOfLines={2}>
            {officeAddress}
          </Text>
          {error ? <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{error}</Text> : null}
        </View>
      </View>
      <TouchableOpacity
        onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(officeAddress + ", Egypt")}`)}
        style={{ marginTop: 12, backgroundColor: C.gold + "18", borderWidth: 1, borderColor: C.gold + "40", borderRadius: 10, padding: 10, alignItems: "center" }}
      >
        <Text style={{ color: C.gold, fontWeight: "700", fontSize: 13 }}>
          {isRTL ? "🗺️ فتح في خرائط Google" : "🗺️ Open in Google Maps"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: C.border }}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ height }}
        initialRegion={{
          latitude:            coords.lat,
          longitude:           coords.lng,
          latitudeDelta:       0.01,
          longitudeDelta:      0.01,
        }}
        showsUserLocation={!!userLoc}
        showsMyLocationButton={false}
        mapType="standard"
      >
        {/* Lawyer office marker */}
        <Marker
          coordinate={{ latitude: coords.lat, longitude: coords.lng }}
          title={lawyerName}
          description={officeAddress}
          pinColor="#9A6F2A"
        />
      </MapView>

      {/* Address bar + directions button */}
      <View style={{
        backgroundColor: C.surface, padding: 12,
        flexDirection: isRTL ? "row-reverse" : "row",
        alignItems: "center", gap: 10,
      }}>
        <Text style={{ fontSize: 16 }}>📍</Text>
        <Text style={{ flex: 1, color: C.muted, fontSize: 12, lineHeight: 16 }} numberOfLines={2}>
          {officeAddress}
        </Text>
        <TouchableOpacity
          onPress={openInMaps}
          style={{ backgroundColor: C.gold, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, flexShrink: 0 }}
        >
          <Text style={{ color: "#000", fontWeight: "700", fontSize: 12 }}>
            {isRTL ? "اتجاهات" : "Directions"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
