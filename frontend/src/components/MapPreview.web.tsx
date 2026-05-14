import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  googleMapsEmbedUrl,
  googleMapsUrl,
  OPEN_FREE_MAP_STYLE_URL,
  openStreetMapUrl,
  validCoordinate,
  type MapPoint,
} from '../utils/maps';

function mapHtml(points: MapPoint[]) {
  const center = points[0];
  const markerData = points.map((point, index) => ({
    latitude: point.latitude,
    longitude: point.longitude,
    label: point.label ?? String(index + 1),
    color: point.color ?? '#ff7a1a',
    icon: point.icon,
  }));

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <style>
    html, body, #map { height: 100%; margin: 0; }
    .marker {
      align-items: center;
      border: 3px solid #ffffff;
      border-radius: 999px;
      box-shadow: 0 8px 20px rgba(0,0,0,.25);
      color: #ffffff;
      display: flex;
      font: 800 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      height: 30px;
      justify-content: center;
      width: 30px;
    }
    .marker svg {
      height: 21px;
      width: 21px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <script>
    const points = ${JSON.stringify(markerData)};
    const map = new maplibregl.Map({
      container: 'map',
      style: '${OPEN_FREE_MAP_STYLE_URL}',
      center: [${center.longitude}, ${center.latitude}],
      zoom: ${points.length > 1 ? 13 : 15},
      attributionControl: true
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      if (points.length > 1) {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: points.map((point) => [point.longitude, point.latitude])
            }
          }
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#ff741f',
            'line-width': 5,
            'line-opacity': 0.9
          }
        });
      }
    });
    points.forEach((point) => {
      const marker = document.createElement('div');
      marker.className = 'marker';
      marker.style.background = point.color;
      if (point.icon === 'motorbike') {
        marker.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M15 30h10l7-10h6M19 20h8l5 10M16 30l5-13M8 32a7 7 0 1 0 14 0A7 7 0 0 0 8 32Zm22 0a7 7 0 1 0 14 0A7 7 0 0 0 30 32Z"/><path fill="#fff" d="M25 14h9v4h-9z"/></svg>';
      } else {
        marker.textContent = point.label.slice(0, 1).toUpperCase();
      }
      new maplibregl.Marker({ element: marker })
        .setLngLat([point.longitude, point.latitude])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setText(point.label))
        .addTo(map);
    });
    if (points.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
      map.fitBounds(bounds, { padding: 56, maxZoom: 15 });
    }
  </script>
</body>
</html>`;
}

export function MapPreview({
  preferCustomMap = false,
  points,
  title,
  subtitle,
}: {
  preferCustomMap?: boolean;
  points: MapPoint[];
  title: string;
  subtitle?: string;
}) {
  const validPoints = points.filter((point) => validCoordinate(point.latitude, point.longitude));
  const primaryPoint = validPoints[0];

  if (!primaryPoint) {
    return (
      <View style={styles.emptyMap}>
        <Text style={styles.mapTitle}>{title}</Text>
        <Text style={styles.mapText}>Location coordinates are not available yet.</Text>
      </View>
    );
  }

  const googleEmbedUrl = preferCustomMap ? null : googleMapsEmbedUrl(validPoints);
  const externalMapUrl = googleEmbedUrl ? googleMapsUrl(primaryPoint) : openStreetMapUrl(primaryPoint);
  const externalMapLabel = googleEmbedUrl ? 'Open in Google Maps' : 'Open in OpenStreetMap';

  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <Text style={styles.mapTitle}>{title}</Text>
        {subtitle ? <Text style={styles.mapText}>{subtitle}</Text> : null}
      </View>

      <View style={styles.mapFrame}>
        <iframe
          sandbox="allow-scripts allow-same-origin"
          src={googleEmbedUrl ?? undefined}
          srcDoc={googleEmbedUrl ? undefined : mapHtml(validPoints)}
          style={{
            border: 0,
            borderRadius: 8,
            height: '100%',
            width: '100%',
          }}
          title={title}
        />
      </View>

      <Pressable
        onPress={() => Linking.openURL(externalMapUrl)}
        style={styles.openButton}
      >
        <Text style={styles.openButtonText}>{externalMapLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  copy: {
    gap: 4,
  },
  mapTitle: {
    color: '#151815',
    fontSize: 15,
    fontWeight: '900',
  },
  mapText: {
    color: '#5f675f',
    fontSize: 13,
    lineHeight: 19,
  },
  mapFrame: {
    backgroundColor: '#e8ece7',
    borderRadius: 8,
    height: 240,
    overflow: 'hidden',
    width: '100%',
  },
  emptyMap: {
    backgroundColor: '#e8ece7',
    borderRadius: 8,
    minHeight: 150,
    padding: 16,
    justifyContent: 'center',
  },
  openButton: {
    alignItems: 'center',
    borderColor: '#176b52',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  openButtonText: {
    color: '#176b52',
    fontSize: 14,
    fontWeight: '900',
  },
});
