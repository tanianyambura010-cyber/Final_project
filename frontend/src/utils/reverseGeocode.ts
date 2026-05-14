import * as Location from 'expo-location';

import { GOOGLE_MAPS_API_KEY } from '../config/maps';

type GoogleGeocodeResponse = {
  results?: {
    formatted_address?: string;
    types?: string[];
  }[];
  status?: string;
};

type OpenStreetMapReverseResponse = {
  display_name?: string;
  name?: string;
  address?: Record<string, string | undefined>;
};

const GOOGLE_RESULT_PRIORITY = [
  'street_address',
  'premise',
  'establishment',
  'point_of_interest',
  'subpremise',
  'route',
];

function cleanAddress(value?: string) {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function formatExpoAddress(address: Location.LocationGeocodedAddress) {
  return cleanAddress([
    address.name,
    address.street,
    address.district,
    address.city,
    address.subregion,
    address.region,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(', '));
}

function formatOpenStreetMapAddress(data: OpenStreetMapReverseResponse) {
  const displayName = cleanAddress(data.display_name);
  const placeName = cleanAddress(data.name);

  if (placeName && displayName && !displayName.toLowerCase().startsWith(placeName.toLowerCase())) {
    return `${placeName}, ${displayName}`;
  }

  if (displayName) {
    return displayName;
  }

  const address = data.address ?? {};
  return cleanAddress([
    address.house_number,
    address.road,
    address.neighbourhood,
    address.suburb,
    address.city ?? address.town ?? address.village,
    address.state,
    address.postcode,
    address.country,
  ]
    .filter(Boolean)
    .join(', '));
}

async function reverseWithGoogle(latitude: number, longitude: number) {
  if (!GOOGLE_MAPS_API_KEY.trim()) {
    return '';
  }

  const params = new URLSearchParams({
    key: GOOGLE_MAPS_API_KEY,
    latlng: `${latitude},${longitude}`,
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);

  if (!response.ok) {
    return '';
  }

  const data = (await response.json()) as GoogleGeocodeResponse;
  if (data.status !== 'OK' || !data.results?.length) {
    return '';
  }

  const preferredResult =
    data.results.find((result) =>
      result.types?.some((type) => GOOGLE_RESULT_PRIORITY.includes(type))
    ) ?? data.results[0];

  return cleanAddress(preferredResult.formatted_address);
}

async function reverseWithOpenStreetMap(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    addressdetails: '1',
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    zoom: '18',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    return '';
  }

  return formatOpenStreetMapAddress((await response.json()) as OpenStreetMapReverseResponse);
}

async function reverseWithExpo(latitude: number, longitude: number) {
  const [firstAddress] = await Location.reverseGeocodeAsync({ latitude, longitude });
  return firstAddress ? formatExpoAddress(firstAddress) : '';
}

export async function reverseGeocodeLabel(latitude: number, longitude: number) {
  try {
    const googleAddress = await reverseWithGoogle(latitude, longitude);

    if (googleAddress) {
      return googleAddress;
    }
  } catch {
    // Fall back to OpenStreetMap below.
  }

  try {
    const openStreetMapAddress = await reverseWithOpenStreetMap(latitude, longitude);

    if (openStreetMapAddress) {
      return openStreetMapAddress;
    }
  } catch {
    // Fall back to the platform geocoder below.
  }

  try {
    return await reverseWithExpo(latitude, longitude);
  } catch {
    return '';
  }
}
