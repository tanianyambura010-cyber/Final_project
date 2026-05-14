import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { reverseGeocodeLabel } from './reverseGeocode';

export type CheckoutLocation = {
  latitude: number;
  longitude: number;
  address: string;
};

function getBrowserPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('This browser does not support GPS location.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (positionError) => {
        if (positionError.code === positionError.PERMISSION_DENIED) {
          reject(
            new Error(
              'Location permission is blocked. Click the site settings icon next to localhost and allow Location, then retry.'
            )
          );
          return;
        }

        reject(new Error(positionError.message || 'Unable to detect your current GPS location.'));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );
  });
}

export async function getCurrentCheckoutLocation(): Promise<CheckoutLocation> {
  if (Platform.OS === 'web') {
    const { latitude, longitude } = await getBrowserPosition();
    const address =
      (await reverseGeocodeLabel(latitude, longitude)) || 'Current GPS delivery location';

    return { latitude, longitude, address };
  }

  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    throw new Error('Location permission was not granted. Allow Location permission, then retry.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude, longitude } = position.coords;
  const address =
    (await reverseGeocodeLabel(latitude, longitude)) || 'Current GPS delivery location';

  return { latitude, longitude, address };
}
