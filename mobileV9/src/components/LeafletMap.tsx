import React, { useRef, useEffect } from 'react';
import { View, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

interface LeafletMapProps {
  lat: number;
  lng: number;
  onLocationSelect?: (lat: number, lng: number) => void;
  style?: any;
  staticMap?: boolean;
}

export default function LeafletMap({ lat, lng, onLocationSelect, style, staticMap = false }: LeafletMapProps) {
  const webViewRef = useRef<WebView>(null);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html { margin: 0; padding: 0; height: 100%; }
        #map { height: 100vh; width: 100vw; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${lat}, ${lng}], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        }).addTo(map);

        var marker = L.marker([${lat}, ${lng}], { draggable: ${!staticMap} }).addTo(map);

        ${!staticMap ? `
        marker.on('dragend', function(e) {
          var position = marker.getLatLng();
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ lat: position.lat, lng: position.lng }));
          }
        });
        
        map.on('click', function(e) {
          marker.setLatLng(e.latlng);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ lat: e.latlng.lat, lng: e.latlng.lng }));
          }
        });
        ` : ''}
      </script>
    </body>
    </html>
  `;

  // Update map center when props change from outside (e.g. geocoding)
  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (typeof map !== 'undefined' && typeof marker !== 'undefined') {
          var newLatLng = new L.LatLng(${lat}, ${lng});
          marker.setLatLng(newLatLng);
          map.setView(newLatLng, 15);
        }
        true;
      `);
    }
  }, [lat, lng]);

  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={{ flex: 1 }}
        scrollEnabled={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.lat && data.lng && onLocationSelect) {
              onLocationSelect(data.lat, data.lng);
            }
          } catch (e) {}
        }}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
            <ActivityIndicator size="large" color="#B8860B" />
          </View>
        )}
      />
    </View>
  );
}
