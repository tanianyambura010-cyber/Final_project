const fallbackLatitude = -1.1059;
const fallbackLongitude = 37.01564;

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const RESTAURANT_LOCATION = {
  name: process.env.EXPO_PUBLIC_RESTAURANT_NAME ?? 'Senate Hotel Juja',
  address: process.env.EXPO_PUBLIC_RESTAURANT_ADDRESS ?? 'Senate Hotel Juja, Meru - Nairobi Hwy, Juja',
  latitude: numberFromEnv(process.env.EXPO_PUBLIC_RESTAURANT_LATITUDE, fallbackLatitude),
  longitude: numberFromEnv(process.env.EXPO_PUBLIC_RESTAURANT_LONGITUDE, fallbackLongitude),
};
