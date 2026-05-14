import { RESTAURANT_LOCATION } from '../config/restaurant';

export const DELIVERY_FEE_PER_KM = Number(process.env.EXPO_PUBLIC_DELIVERY_FEE_PER_KM ?? 50);
export const DELIVERY_FIRST_KM_FEE = Number(
  process.env.EXPO_PUBLIC_DELIVERY_FIRST_KM_FEE ?? DELIVERY_FEE_PER_KM
);
export const DELIVERY_INCLUDED_KM = Number(process.env.EXPO_PUBLIC_DELIVERY_INCLUDED_KM ?? 1);

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

// Calculate straight-line distance between two GPS points.
export function distanceInKm(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number
) {
  const earthRadiusKm = 6371;
  const latitudeDelta = degreesToRadians(toLatitude - fromLatitude);
  const longitudeDelta = degreesToRadians(toLongitude - fromLongitude);
  const startLatitude = degreesToRadians(fromLatitude);
  const endLatitude = degreesToRadians(toLatitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function deliveryDistanceKm(latitude: number, longitude: number) {
  return distanceInKm(
    RESTAURANT_LOCATION.latitude,
    RESTAURANT_LOCATION.longitude,
    latitude,
    longitude
  );
}

export function calculateDeliveryFee(latitude: number, longitude: number) {
  // The first kilometre has a fixed fee; extra distance is billed per km.
  const billableDistanceKm = Math.max(deliveryDistanceKm(latitude, longitude) - DELIVERY_INCLUDED_KM, 0);
  return Math.round(DELIVERY_FIRST_KM_FEE + billableDistanceKm * DELIVERY_FEE_PER_KM);
}
