import { API_BASE_URL } from '../config/api';

export type Rider = {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone: string;
  vehicleType: string;
  plateNumber: string | null;
  isAvailable: boolean;
  currentStatus: 'available' | 'busy' | 'offline';
};

type RidersResponse = {
  riders: Rider[];
};

type RiderResponse = {
  rider: Rider;
};

export type CreateRiderPayload = {
  userId?: number;
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  vehicleType: string;
  plateNumber?: string;
};

type ApiErrorBody = {
  message?: string;
  details?: {
    fieldErrors?: Record<string, string[]>;
  };
};

async function parseApiError(response: Response) {
  try {
    const body = (await response.json()) as ApiErrorBody;
    const firstFieldError = body.details?.fieldErrors
      ? Object.entries(body.details.fieldErrors).find((entry) => entry[1]?.[0])
      : null;

    if (firstFieldError) {
      return `${firstFieldError[0]}: ${firstFieldError[1][0]}`;
    }

    return body.message ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export async function fetchRiders(token: string): Promise<Rider[]> {
  const response = await fetch(`${API_BASE_URL}/riders`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as RidersResponse;
  return data.riders;
}

export async function createRiderProfile(
  token: string,
  payload: CreateRiderPayload
): Promise<Rider> {
  const response = await fetch(`${API_BASE_URL}/riders`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as RiderResponse;
  return data.rider;
}

export async function fetchMyRiderProfile(token: string): Promise<Rider> {
  const response = await fetch(`${API_BASE_URL}/riders/me`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as RiderResponse;
  return data.rider;
}

export async function updateMyRiderStatus(
  token: string,
  currentStatus: Rider['currentStatus']
): Promise<{ currentStatus: Rider['currentStatus']; isAvailable: boolean }> {
  const response = await fetch(`${API_BASE_URL}/riders/me/status`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ currentStatus }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as {
    currentStatus: Rider['currentStatus'];
    isAvailable: boolean;
  };
}
