import { API_BASE_URL } from '../config/api';

export type RiderLocation = {
  riderId?: number;
  riderUserId?: number;
  orderId: number;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  recordedAt?: string;
};

export type SnakeCaseRiderLocation = {
  rider_id?: number;
  order_id: number;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  recorded_at?: string;
};

type TrackingResponse = {
  location: null | RiderLocation | SnakeCaseRiderLocation;
};

type ApiErrorBody = {
  message?: string;
};

async function parseApiError(response: Response) {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.message ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

function isSnakeCaseLocation(location: RiderLocation | SnakeCaseRiderLocation): location is SnakeCaseRiderLocation {
  return 'order_id' in location;
}

export function normalizeRiderLocation(
  location: RiderLocation | SnakeCaseRiderLocation
): RiderLocation {
  if (isSnakeCaseLocation(location)) {
    return {
      riderId: location.rider_id,
      orderId: location.order_id,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      heading: location.heading == null ? null : Number(location.heading),
      speed: location.speed == null ? null : Number(location.speed),
      recordedAt: location.recorded_at,
    };
  }

  return {
    riderId: location.riderId,
    riderUserId: location.riderUserId,
    orderId: location.orderId,
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    heading: location.heading == null ? null : Number(location.heading),
    speed: location.speed == null ? null : Number(location.speed),
    recordedAt: location.recordedAt,
  };
}

export async function fetchLatestOrderLocation(
  token: string,
  orderId: number
): Promise<RiderLocation | null> {
  const response = await fetch(`${API_BASE_URL}/tracking/orders/${orderId}/latest`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as TrackingResponse;

  if (!data.location) {
    return null;
  }

  const location = data.location;
  return normalizeRiderLocation(location);
}
