import { API_BASE_URL } from '../config/api';

export type MenuItem = {
  id: number;
  name: string;
  description: string | null;
  category: string;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type MenuResponse = {
  items: MenuItem[];
};

type MenuItemResponse = {
  item: MenuItem;
};

type UploadImageResponse = {
  imageUrl: string;
  filename: string;
};

type ApiErrorBody = {
  message?: string;
};

export type MenuItemPayload = {
  name: string;
  description?: string;
  category: string;
  price: number;
  imageUrl?: string;
  isAvailable?: boolean;
};

type MenuQuery = {
  available?: boolean;
  category?: string;
  search?: string;
};

async function parseApiError(response: Response) {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.message ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

function menuQueryString(query: MenuQuery) {
  const params = new URLSearchParams();

  if (query.available !== undefined) {
    params.set('available', String(query.available));
  }

  if (query.category) {
    params.set('category', query.category);
  }

  if (query.search) {
    params.set('search', query.search);
  }

  const value = params.toString();
  return value ? `?${value}` : '';
}

export async function fetchMenuItems(query: MenuQuery = { available: true }): Promise<MenuItem[]> {
  const response = await fetch(`${API_BASE_URL}/menu${menuQueryString(query)}`);

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as MenuResponse;
  return data.items;
}

export async function createMenuItem(token: string, payload: MenuItemPayload): Promise<MenuItem> {
  const response = await fetch(`${API_BASE_URL}/menu`, {
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

  const data = (await response.json()) as MenuItemResponse;
  return data.item;
}

export async function updateMenuItem(
  token: string,
  itemId: number,
  payload: Partial<MenuItemPayload>
): Promise<MenuItem> {
  const response = await fetch(`${API_BASE_URL}/menu/${itemId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as MenuItemResponse;
  return data.item;
}

export async function updateMenuAvailability(
  token: string,
  itemId: number,
  isAvailable: boolean
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/menu/${itemId}/availability`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ isAvailable }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export type UploadMenuImageInput = {
  uri: string;
  name?: string | null;
  type?: string | null;
  file?: Blob;
};

export async function uploadMenuImage(
  token: string,
  image: UploadMenuImageInput
): Promise<UploadImageResponse> {
  const formData = new FormData();

  if (image.file) {
    formData.append('image', image.file, image.name ?? 'menu-image.jpg');
  } else {
    formData.append('image', {
      uri: image.uri,
      name: image.name ?? 'menu-image.jpg',
      type: image.type ?? 'image/jpeg',
    } as unknown as Blob);
  }

  const response = await fetch(`${API_BASE_URL}/menu/images`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as UploadImageResponse;
}
