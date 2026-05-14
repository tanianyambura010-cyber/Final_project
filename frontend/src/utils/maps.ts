import { GOOGLE_MAPS_API_KEY } from '../config/maps';

export type MapPoint = {
  latitude: number;
  longitude: number;
  label?: string;
  color?: string;
  icon?: 'motorbike';
};

export function validCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function googleMapsUrl(point: MapPoint) {
  return `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`;
}

export function openStreetMapUrl(point: MapPoint, zoom = 16) {
  return `https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=${zoom}/${point.latitude}/${point.longitude}`;
}

export const OPEN_FREE_MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

export function hasGoogleMapsApiKey() {
  return Boolean(GOOGLE_MAPS_API_KEY.trim());
}

export function googleMapsEmbedUrl(points: MapPoint[]) {
  const validPoints = points.filter((point) => validCoordinate(point.latitude, point.longitude));

  if (!hasGoogleMapsApiKey() || validPoints.length === 0) {
    return null;
  }

  const params = new URLSearchParams({
    key: GOOGLE_MAPS_API_KEY,
  });

  if (validPoints.length === 1) {
    const [point] = validPoints;
    params.set('q', `${point.latitude},${point.longitude}`);
    params.set('zoom', '16');
    return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
  }

  const [origin] = validPoints;
  const destination = validPoints[validPoints.length - 1];
  const waypoints = validPoints.slice(1, -1);
  params.set('origin', `${origin.latitude},${origin.longitude}`);
  params.set('destination', `${destination.latitude},${destination.longitude}`);
  params.set('mode', 'driving');

  if (waypoints.length > 0) {
    params.set(
      'waypoints',
      waypoints.map((point) => `${point.latitude},${point.longitude}`).join('|')
    );
  }

  return `https://www.google.com/maps/embed/v1/directions?${params.toString()}`;
}

export function googleStaticMapUrl(points: MapPoint[], width = 640, height = 360) {
  if (!hasGoogleMapsApiKey() || points.length === 0) {
    return null;
  }

  const center = points[0];
  const markers = points
    .map((point) => {
      const color = encodeURIComponent(point.color ?? 'red');
      const label = point.label ? `%7Clabel:${encodeURIComponent(point.label.slice(0, 1))}` : '';
      return `markers=color:${color}${label}%7C${point.latitude},${point.longitude}`;
    })
    .join('&');

  return `https://maps.googleapis.com/maps/api/staticmap?center=${center.latitude},${center.longitude}&zoom=15&size=${width}x${height}&scale=2&${markers}&key=${GOOGLE_MAPS_API_KEY}`;
}
